import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { GALLERY_PHOTO_WHERE, isSystemAlbumName, mediaIdFromUrl } from '@/lib/media'
import { deleteOwnPhoto, setMainPhoto } from '@/lib/photos'

// Legacy: photos hosted on Cloudinary (or the demo/seed hosts).
const ALLOWED_PHOTO_HOSTS = new Set(['res.cloudinary.com', 'images.unsplash.com', 'picsum.photos'])

function isAllowedPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && ALLOWED_PHOTO_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

/** GET /api/photos — my gallery photos (chat images and the profile video excluded). */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const photos = await db.photo.findMany({
      where: { userId: session.user.id, ...GALLERY_PHOTO_WHERE },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('GET /api/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/photos { url, thumbnailUrl?, isPrivate?, isProfile?, caption? }
 *
 * For our own media (`/api/media/<id>` returned by POST /api/upload) the
 * Photo row already exists: this updates its flags (idempotent). Legacy
 * Cloudinary URLs still create a new row.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { url } = body
    const thumbnailUrl = body.thumbnailUrl == null ? undefined : body.thumbnailUrl
    const isPrivate = typeof body.isPrivate === 'boolean' ? body.isPrivate : undefined
    const isProfile = body.isProfile === true
    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 300) : undefined

    const ownId = typeof url === 'string' ? mediaIdFromUrl(url) : null
    if (ownId) {
      const existing = await db.photo.findUnique({ where: { id: ownId }, include: { album: { select: { name: true, isPrivate: true } } } })
      if (!existing || existing.userId !== userId || isSystemAlbumName(existing.album?.name) || !existing.mimeType?.startsWith('image/')) {
        return NextResponse.json({ error: 'A valid uploaded photo url is required' }, { status: 400 })
      }
      // A private flag on a photo that sits in an album takes it out of the album
      // (album privacy decides for photos inside albums).
      const leaveAlbum = isPrivate !== undefined && existing.album && existing.album.isPrivate !== isPrivate
      const willBePrivate = isPrivate ?? existing.isPrivate
      if (isProfile && willBePrivate) {
        return NextResponse.json({ error: 'Your main photo must be public' }, { status: 400 })
      }
      if (willBePrivate && existing.isProfile) {
        // A private photo can't stay the main photo.
        await db.profile.updateMany({ where: { userId, profilePhoto: existing.url }, data: { profilePhoto: null } })
      }
      let photo = await db.photo.update({
        where: { id: existing.id },
        data: {
          ...(willBePrivate ? { isProfile: false } : {}),
          ...(isPrivate !== undefined ? { isPrivate } : {}),
          ...(leaveAlbum ? { albumId: null } : {}),
          ...(caption !== undefined ? { caption: caption || null } : {}),
        },
      })
      // First public photo becomes the main photo when there is none yet (onboarding).
      const makeMain = isProfile || (!photo.isPrivate && !(await db.photo.findFirst({ where: { userId, isProfile: true }, select: { id: true } })))
      if (makeMain) {
        await setMainPhoto(userId, photo)
        photo = { ...photo, isProfile: true }
      }
      return NextResponse.json({ photo, id: photo.id }, { status: 200 })
    }

    if (!isAllowedPhotoUrl(url)) {
      return NextResponse.json({ error: 'A valid uploaded photo url is required' }, { status: 400 })
    }
    if (thumbnailUrl !== undefined && !isAllowedPhotoUrl(thumbnailUrl)) {
      return NextResponse.json({ error: 'Invalid thumbnailUrl' }, { status: 400 })
    }

    const photo = await db.photo.create({
      data: { userId, url, thumbnailUrl, isPrivate: isPrivate ?? false, caption, isProfile: false },
    })
    if (isProfile && !photo.isPrivate) await setMainPhoto(userId, photo)

    return NextResponse.json({ photo: { ...photo, isProfile: isProfile && !photo.isPrivate }, id: photo.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/photos { photoId } — same as DELETE /api/photos/<id>. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { photoId?: unknown } | null
    const photoId = body?.photoId

    if (!isValidId(photoId)) {
      return NextResponse.json({ error: 'photoId is required' }, { status: 400 })
    }
    const result = await deleteOwnPhoto(session.user.id, photoId)
    if (!result) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
