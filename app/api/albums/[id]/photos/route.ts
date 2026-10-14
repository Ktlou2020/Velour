import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { findUserAlbum } from '@/lib/albums'
import { GALLERY_PHOTO_WHERE } from '@/lib/media'

/** POST /api/albums/<id>/photos { photoIds: string[] } — move my photos into this album. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    const album = await findUserAlbum(id)
    if (!album || album.ownerId !== userId) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

    const body = await req.json().catch(() => null) as { photoIds?: unknown } | null
    const photoIds = Array.isArray(body?.photoIds) ? body.photoIds : null
    if (!photoIds || photoIds.length === 0 || photoIds.length > 300 || !photoIds.every(isValidId)) {
      return NextResponse.json({ error: 'photoIds must be a list of your photo ids' }, { status: 400 })
    }
    const photos = await db.photo.findMany({
      where: { id: { in: photoIds }, userId, ...GALLERY_PHOTO_WHERE },
      select: { id: true, isProfile: true, albumId: true },
    })
    if (photos.length !== new Set(photoIds).size) {
      return NextResponse.json({ error: 'photoIds must be a list of your photo ids' }, { status: 400 })
    }
    if (album.isPrivate && photos.some((p) => p.isProfile)) {
      return NextResponse.json({ error: 'Your main photo can’t go in a private album. Choose a different main photo first.' }, { status: 400 })
    }
    const ids = photos.map((p) => p.id)
    const previousAlbums = [...new Set(photos.map((p) => p.albumId).filter((a): a is string => !!a && a !== id))]
    await db.$transaction([
      db.photo.updateMany({ where: { id: { in: ids } }, data: { albumId: id, isPrivate: album.isPrivate } }),
      db.album.updateMany({ where: { id: { in: previousAlbums }, coverPhotoId: { in: ids } }, data: { coverPhotoId: null } }),
    ])
    return NextResponse.json({ moved: ids.length })
  } catch (error) {
    console.error('POST /api/albums/[id]/photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
