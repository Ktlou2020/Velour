import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { mediaThumbUrl, mediaUrl } from '@/lib/media'
import { deleteOwnPhoto, setMainPhoto } from '@/lib/photos'
import { isValidId } from '@/lib/security'
import { MAX_IMAGE_BYTES, MediaError, deleteFiles, saveImage } from '@/lib/storage'

/**
 * Admin photo management for DEMO profiles only (User.isDemo). Real members'
 * photos can never be changed here. Every upload requires the admin to confirm
 * they hold the rights to the image and the pictured person consented.
 */

const MAX_DEMO_PHOTOS = 9

async function demoUser(userId: unknown) {
  if (!isValidId(userId)) return null
  return db.user.findFirst({ where: { id: userId, isDemo: true }, select: { id: true, username: true } })
}

/** GET → demo profiles with their public photos. */
export async function GET() {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const users = await db.user.findMany({
    where: { isDemo: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true, city: true, isCouple: true, gender: true } },
      photos: {
        where: { isPrivate: false, albumId: null },
        orderBy: [{ isProfile: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, url: true, thumbnailUrl: true, isProfile: true },
      },
    },
  })
  return NextResponse.json({ users, max: MAX_DEMO_PHOTOS })
}

/** POST multipart { userId, file, rightsConfirmed: "yes", makeMain?: "1" } → adds a public photo. */
export async function POST(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
    if (form.get('rightsConfirmed') !== 'yes') {
      return NextResponse.json({ error: 'Confirm you have the rights to use this image first.' }, { status: 400 })
    }
    const user = await demoUser(form.get('userId'))
    if (!user) return NextResponse.json({ error: 'Demo profile not found' }, { status: 404 })

    const entry = form.get('file')
    const file = entry && typeof entry === 'object' && typeof (entry as Blob).arrayBuffer === 'function' ? (entry as Blob) : null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be under 10MB' }, { status: 413 })

    const count = await db.photo.count({ where: { userId: user.id, isPrivate: false, albumId: null } })
    if (count >= MAX_DEMO_PHOTOS) return NextResponse.json({ error: `Up to ${MAX_DEMO_PHOTOS} photos per profile.` }, { status: 400 })

    const stored = await saveImage(Buffer.from(await file.arrayBuffer()))
    const id = 'm' + crypto.randomBytes(15).toString('hex').slice(0, 24)
    const url = mediaUrl(id)
    let photo
    try {
      photo = await db.photo.create({
        data: { id, userId: user.id, url, thumbnailUrl: mediaThumbUrl(id), isPrivate: false, storageKey: stored.key, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes },
        select: { id: true, url: true, thumbnailUrl: true, isProfile: true },
      })
    } catch (e) {
      await deleteFiles([stored.key, stored.thumbKey])
      throw e
    }
    const hasMain = await db.photo.count({ where: { userId: user.id, isProfile: true } })
    if (form.get('makeMain') === '1' || hasMain === 0) {
      await setMainPhoto(user.id, photo)
      photo = { ...photo, isProfile: true }
    }
    await audit(me.id, 'DEMO_PHOTO_ADDED', user.id, { username: user.username, photoId: photo.id, rightsConfirmed: true })
    return NextResponse.json({ photo }, { status: 201 })
  } catch (error) {
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('POST /api/admin/demo/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH { userId, photoId, action: 'main' } → make it the profile photo. */
export async function PATCH(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown; photoId?: unknown; action?: unknown }
  const user = await demoUser(body.userId)
  if (!user || !isValidId(body.photoId) || body.action !== 'main') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const photo = await db.photo.findFirst({ where: { id: body.photoId, userId: user.id, isPrivate: false }, select: { id: true, url: true } })
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  await setMainPhoto(user.id, photo)
  return NextResponse.json({ ok: true })
}

/** DELETE ?userId=&photoId= → remove a demo profile photo (and its files). */
export async function DELETE(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const user = await demoUser(sp.get('userId'))
  const photoId = sp.get('photoId')
  if (!user || !isValidId(photoId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ok = await deleteOwnPhoto(user.id, photoId)
  if (!ok) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  // Promote the next photo so the profile keeps a main picture.
  const next = await db.photo.findFirst({ where: { userId: user.id, isPrivate: false, albumId: null }, orderBy: { createdAt: 'asc' }, select: { id: true, url: true } })
  const hasMain = await db.photo.count({ where: { userId: user.id, isProfile: true } })
  if (next && hasMain === 0) await setMainPhoto(user.id, next)
  await audit(me.id, 'DEMO_PHOTO_REMOVED', user.id, { username: user.username, photoId })
  return NextResponse.json({ ok: true })
}
