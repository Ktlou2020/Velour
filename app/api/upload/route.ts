import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPlatinum } from '@/lib/premium'
import { getClientIp, rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MediaError, deleteFiles, photoFileKeys, saveAudio, saveImage, saveVideo, sniffVideo, videoDurationSec } from '@/lib/storage'
import { CHAT_VIDEO_MAX_BYTES, chatVideoRules, getMessageAllowance, messageLimitError } from '@/lib/chat-priority'
import { CHAT_ALBUM_NAME, VIDEO_ALBUM_NAME, isSystemAlbumName, mediaThumbUrl, mediaUrl } from '@/lib/media'
import { systemAlbumId } from '@/lib/media-access'
import { isValidId } from '@/lib/security'

export const runtime = 'nodejs'

const MAX_GALLERY_PHOTOS = 300

/** Cuid-like id we can turn into a URL before the row exists. */
function newMediaId(): string {
  return 'm' + crypto.randomBytes(15).toString('hex').slice(0, 24)
}

/** Delete this user's chat images / voice notes that were uploaded > 1 day ago but never sent. */
async function sweepUnsentChatImages(userId: string, albumId: string) {
  const stale = await db.photo.findMany({
    where: { userId, albumId, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true, url: true, storageKey: true, mimeType: true },
    take: 50,
  })
  if (!stale.length) return
  const urls = stale.map((s) => s.url)
  const used = await db.message.findMany({
    where: {
      senderId: userId,
      OR: [
        { imageUrl: { in: urls } },
        { audioUrl: { in: urls } },
        ...urls.map((url) => ({ meta: { path: ['videoUrl'], equals: url } })),
      ],
    },
    select: { imageUrl: true, audioUrl: true, meta: true },
  })
  const usedSet = new Set(used.flatMap((u) => [
    u.imageUrl,
    u.audioUrl,
    u.meta && typeof u.meta === 'object' && !Array.isArray(u.meta) ? (u.meta as { videoUrl?: string }).videoUrl : null,
  ]))
  const orphans = stale.filter((s) => !usedSet.has(s.url))
  if (!orphans.length) return
  await db.photo.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } })
  await deleteFiles(orphans.flatMap(photoFileKeys))
}

/**
 * POST /api/upload  (multipart/form-data)
 *   file     the image or video
 *   purpose  "gallery" (default) | "chat" | "voice" | "chatvideo" | "video"   (legacy: kind=video)
 *   albumId  optional, gallery uploads only: put the photo straight into one of my albums
 *
 * Gallery photos are created immediately as normal Photo rows owned by the
 * uploader (so nothing is ever orphaned); POST /api/photos with the returned
 * url then just updates that row. Chat images and the profile video go into
 * hidden per-user albums and never appear in the gallery.
 *
 * 201 → { url, thumbnailUrl, id, photo, width?, height? }
 * 201 (purpose=voice) → { url, id, mimeType }   (WebM / MP4·M4A / Ogg, ≤ 5MB)
 * 201 (purpose=chatvideo) → { url, id, mimeType, durationSec }  (MP4 / MOV / WebM; size and
 *     length capped per plan — the length is read from the file itself)
 * Chat uploads are refused (429) when the Free plan's message allowance is
 * used up, so nobody uploads for nothing — POST messages enforces it again.
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
    if (declared > Math.max(MAX_VIDEO_BYTES, CHAT_VIDEO_MAX_BYTES.PLATINUM) + 1024 * 1024) {
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
    const purpose = rawPurpose === 'chat' || rawPurpose === 'video' || rawPurpose === 'voice' || rawPurpose === 'chatvideo' ? rawPurpose : 'gallery'

    if (purpose === 'chat' || purpose === 'voice' || purpose === 'chatvideo') {
      const allowance = await getMessageAllowance(userId)
      if (allowance.remaining !== null && allowance.remaining <= 0) {
        return NextResponse.json(messageLimitError(allowance), { status: 429 })
      }
    }

    if (purpose === 'chatvideo') {
      const rules = await chatVideoRules(userId)
      if (file.size > rules.maxBytes) {
        return NextResponse.json({ error: `Videos must be under ${Math.round(rules.maxBytes / 1024 / 1024)}MB on your plan` }, { status: 413 })
      }
      const input = Buffer.from(await file.arrayBuffer())
      const sniffed = sniffVideo(input)
      if (!sniffed) return NextResponse.json({ error: 'Please send an MP4, MOV or WebM video' }, { status: 415 })
      // Length from the file bytes (moov/mvhd or WebM Info/Clusters), +0.5s tolerance
      const duration = videoDurationSec(input, sniffed)
      if (duration === null && rules.plan === 'FREE') {
        return NextResponse.json({ error: 'We couldn’t read this video’s length. Please try a different MP4 or MOV.' }, { status: 415 })
      }
      if (duration !== null && duration > rules.maxSec + 0.5) {
        return NextResponse.json({
          error: rules.plan === 'FREE'
            ? `Free plan videos can be up to ${rules.maxSec} seconds — trim it or go Gold for 60-second videos`
            : `Videos can be up to ${rules.maxSec} seconds on your plan`,
          maxSec: rules.maxSec,
          durationSec: Math.round(duration * 10) / 10,
          upgrade: rules.plan !== 'PLATINUM',
        }, { status: 422 })
      }
      const stored = await saveVideo(input, rules.maxBytes)
      // Serve MOV as MP4: same ISO-BMFF container, and Chrome/Android play it as video/mp4
      const mimeType = stored.mimeType === 'video/quicktime' ? 'video/mp4' : stored.mimeType
      const albumId = await systemAlbumId(userId, CHAT_ALBUM_NAME)
      sweepUnsentChatImages(userId, albumId).catch(() => {})
      const id = newMediaId()
      const url = mediaUrl(id)
      try {
        await db.photo.create({
          data: {
            id, userId, url, albumId, isPrivate: true, storageKey: stored.key, mimeType, sizeBytes: stored.sizeBytes,
            // Chat videos never appear in the gallery, so `order` holds the parsed
            // length in milliseconds (-1 = unknown) for POST messages to re-check.
            order: duration === null ? -1 : Math.round(duration * 1000),
          },
        })
      } catch (e) {
        await deleteFiles([stored.key])
        throw e
      }
      return NextResponse.json({ url, id, mimeType, durationSec: duration === null ? null : Math.round(duration * 10) / 10 }, { status: 201 })
    }

    if (purpose === 'voice') {
      if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'Voice notes must be under 5MB' }, { status: 413 })
      // Type is decided by sniffing the bytes, never by the client's mime type.
      const stored = await saveAudio(Buffer.from(await file.arrayBuffer()))
      const albumId = await systemAlbumId(userId, CHAT_ALBUM_NAME)
      sweepUnsentChatImages(userId, albumId).catch(() => {})
      const id = newMediaId()
      const url = mediaUrl(id)
      try {
        await db.photo.create({
          data: { id, userId, url, albumId, isPrivate: true, storageKey: stored.key, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes },
        })
      } catch (e) {
        await deleteFiles([stored.key])
        throw e
      }
      return NextResponse.json({ url, id, mimeType: stored.mimeType }, { status: 201 })
    }

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
