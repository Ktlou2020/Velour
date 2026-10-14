import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'

// Photos must be hosted on our image CDN (or the demo/seed hosts).
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

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const photos = await db.photo.findMany({
      where: { userId: session.user.id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('GET /api/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { url } = body
    const thumbnailUrl = body.thumbnailUrl == null ? undefined : body.thumbnailUrl
    const isPrivate = body.isPrivate === true
    const isProfile = body.isProfile === true
    const caption = typeof body.caption === 'string' ? body.caption.slice(0, 300) : undefined

    if (!isAllowedPhotoUrl(url)) {
      return NextResponse.json({ error: 'A valid uploaded photo url is required' }, { status: 400 })
    }
    if (thumbnailUrl !== undefined && !isAllowedPhotoUrl(thumbnailUrl)) {
      return NextResponse.json({ error: 'Invalid thumbnailUrl' }, { status: 400 })
    }

    // If setting as profile photo, clear existing profile flags
    if (isProfile) {
      await db.photo.updateMany({
        where: { userId: session.user.id, isProfile: true },
        data: { isProfile: false },
      })
    }

    const photo = await db.photo.create({
      data: {
        userId: session.user.id,
        url,
        thumbnailUrl,
        isPrivate,
        caption,
        isProfile,
      },
    })

    // Update profile photo URL
    if (isProfile) {
      await db.profile.updateMany({
        where: { userId: session.user.id },
        data: { profilePhoto: url },
      })
    }

    return NextResponse.json({ photo }, { status: 201 })
  } catch (error) {
    console.error('POST /api/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const photo = await db.photo.findUnique({ where: { id: photoId } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    if (photo.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.photo.delete({ where: { id: photoId } })

    // If deleted photo was the profile photo, clear it
    if (photo.isProfile) {
      await db.profile.updateMany({
        where: { userId: session.user.id },
        data: { profilePhoto: null },
      })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
