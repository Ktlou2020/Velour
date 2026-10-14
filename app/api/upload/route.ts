import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPlatinum } from '@/lib/premium'
import { getClientIp, rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MediaError, deleteFiles, photoFileKeys, saveImage, saveVideo } from '@/lib/storage'
import { CHAT_ALBUM_NAME, VIDEO_ALBUM_NAME, isSystemAlbumName, mediaThumbUrl, mediaUrl } from '@/lib/media'
import { systemAlbumId } from '@/lib/media-access'
import { isValidId } from '@/lib/security'

export const runtime = 'nodejs'

const MAX_GALLERY_PHOTOS = 300

/** Cuid-like id we can turn into a URL before the row exists. */
function newMediaId(): string {
  return 'm' + crypto.randomBytes(15).toString('hex').slice(0, 24)
}

/** Delete this user's chat images that were uploaded > 1 day ago but never sent. */
async function sweepUnsentChatImages(userId: string, albumId: string) {
  const stale = await db.photo.findMany({
    where: { userId, albumId, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true, url: true, storageKey: true, mimeType: true },
    take: 50,
  })
  if (!stale.length) return
  const used = await db.message.findMany({
    where: { senderId: userId, imageUrl: { in: stale.map((s) => s.url) } },
    select: { imageUrl: true },
  })
  const usedSet = new Set(used.map((u) => u.imageUrl))
  const orphans = stale.filter((s) => !usedSet.has(s.url))
  if (!orphans.length) return
  await db.photo.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } })
  await deleteFiles(orphans.flatMap(photoFileKeys))
}

/**
 * POST /api/upload  (multipart/form-data)
 *   file     the image or video
 *   purpose  "gallery" (default) | "chat" | "video"   (legacy: kind=video)
 *   albumId  optional, gallery uploads only: put the photo straight into one of my albums
 *
 * Gallery photos are created immediately as normal Photo rows owned by the
 * uploader (so nothing is ever orphaned); POST /api/photos with the returned
 * url then just updates that row. Chat images and the profile video go into
 * hidden per-user albums and never appear in the gallery.
 *
 * 201 → { url, thumbnailUrl, id, photo, width?, height? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!rateLimit(`upload:${userId}`, 40, 10 * 60 * 1000) || !rateLimit(`upload:ip:${getClientIp(req.headers)}`, 80, 10 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    // Refuse obviously oversized bodies before buffering them.
    const declared = Number(req.headers.get('content-length') || 0)
    if (declared > MAX_VIDEO_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: 'File is too large' }, { status: 413 })
    }

    const formData = await req.formData().catch(() => null)
    const entry = formData?.get('file')
    // Don't use `instanceof File`: the global File class doesn't exist on Node 18.
    const file = entry && typeof entry === 'object' && typeof (entry as Blob).arrayBuffer === 'function'
      ? (entry as Blob & { name?: string })
      : null
    if (!formData || !file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const rawPurpose = formData.get('purpose') ?? (formData.get('kind') === 'video' ? 'video' : 'gallery')
    const purpose = rawPurpose === 'chat' || rawPurpose === 'video' ? rawPurpose : 'gallery'

    if (purpose === 'video') {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true, profile: { select: { membershipTier: true, videoUrl: true } } },
      })
      if (!isPlatinum(user?.profile?.membershipTier, user?.role)) {
        return NextResponse.json({ error: 'Video profiles are a Platinum feature' }, { status: 403 })
      }
      if (file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: 'Video must be under 30MB' }, { status: 413 })

      const stored = await saveVideo(Buffer.from(await file.arrayBuffer()))
      const albumId = await systemAlbumId(userId, VIDEO_ALBUM_NAME)
      const id = newMediaId()
      const url = mediaUrl(id)

      // Clean up earlier uploads that never became (or no longer are) the profile video.
      const old = await db.photo.findMany({
        where: { userId, albumId, url: { not: user?.profile?.videoUrl ?? '' } },
        select: { id: true, storageKey: true, mimeType: true },
      })

      const photo = await db.photo.create({
        data: { id, userId, url, albumId, isPrivate: true, storageKey: stored.key, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes },
      })
      if (old.length) {
        await db.photo.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
        deleteFiles(old.flatMap(photoFileKeys)).catch(() => {})
      }
      return NextResponse.json({ url, id: photo.id, posterUrl: null, duration: null, mimeType: stored.mimeType }, { status: 201 })
    }

    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be under 10MB' }, { status: 413 })

    let albumId: string | null = null
    let isPrivate = false
    if (purpose === 'chat') {
      albumId = await systemAlbumId(userId, CHAT_ALBUM_NAME)
      isPrivate = true
      sweepUnsentChatImages(userId, albumId).catch(() => {})
    } else {
      const count = await db.photo.count({
        where: { userId, OR: [{ albumId: null }, { album: { name: { notIn: [CHAT_ALBUM_NAME, VIDEO_ALBUM_NAME] } } }] },
      })
      if (count >= MAX_GALLERY_PHOTOS) {
        return NextResponse.json({ error: `You can keep up to ${MAX_GALLERY_PHOTOS} photos. Delete some to upload more.` }, { status: 400 })
      }
      const requestedAlbum = formData.get('albumId')
      if (typeof requestedAlbum === 'string' && requestedAlbum) {
        if (!isValidId(requestedAlbum)) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
        const album = await db.album.findFirst({ where: { id: requestedAlbum, ownerId: userId }, select: { id: true, name: true, isPrivate: true } })
        if (!album || isSystemAlbumName(album.name)) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
        albumId = album.id
        isPrivate = album.isPrivate
      }
    }

    const stored = await saveImage(Buffer.from(await file.arrayBuffer()))
    const id = newMediaId()
    const url = mediaUrl(id)
    const thumbnailUrl = mediaThumbUrl(id)
    const last = purpose === 'gallery'
      ? await db.photo.findFirst({ where: { userId }, orderBy: { order: 'desc' }, select: { order: true } })
      : null

    try {
      const photo = await db.photo.create({
        data: {
          id,
          userId,
          url,
          thumbnailUrl,
          albumId,
          isPrivate,
          order: (last?.order ?? -1) + 1,
          storageKey: stored.key,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      })
      return NextResponse.json(
        { url, thumbnailUrl, id: photo.id, photo, width: stored.width, height: stored.height },
        { status: 201 },
      )
    } catch (e) {
      await deleteFiles([stored.key, stored.thumbKey])
      throw e
    }
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/upload error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 500 })
  }
}
