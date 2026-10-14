import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { isSystemAlbumName } from '@/lib/media'
import { deleteOwnPhoto, setMainPhoto } from '@/lib/photos'

/**
 * PATCH /api/photos/<id> { isPrivate?, isProfile?, caption?, albumId? (string | null) }
 *
 * Privacy of a photo inside an album follows the album. Setting isPrivate on
 * such a photo to the opposite of its album's privacy takes it out of the album.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const raw = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!raw) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const body = {
      isPrivate: typeof raw.isPrivate === 'boolean' ? raw.isPrivate : undefined,
      isProfile: raw.isProfile === true ? true : undefined,
      caption: typeof raw.caption === 'string' ? raw.caption.trim().slice(0, 300) : undefined,
      albumId: raw.albumId === null ? null : typeof raw.albumId === 'string' ? raw.albumId : undefined,
    }

    const photo = await db.photo.findUnique({ where: { id }, include: { album: { select: { name: true, isPrivate: true } } } })
    if (!photo || photo.userId !== userId || isSystemAlbumName(photo.album?.name)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let albumId: string | null = photo.albumId
    let isPrivate = photo.isPrivate

    if (body.albumId !== undefined) {
      if (body.albumId === null) {
        albumId = null
      } else {
        if (!isValidId(body.albumId)) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
        const album = await db.album.findFirst({ where: { id: body.albumId, ownerId: userId }, select: { id: true, name: true, isPrivate: true } })
        if (!album || isSystemAlbumName(album.name)) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
        albumId = album.id
        isPrivate = album.isPrivate
      }
    }
    if (body.isPrivate !== undefined) {
      if (albumId && body.isPrivate !== isPrivate) albumId = null
      isPrivate = body.isPrivate
    }

    if (isPrivate && (photo.isProfile || body.isProfile)) {
      return NextResponse.json({ error: 'Your main photo must stay public. Choose a different main photo first.' }, { status: 400 })
    }

    let updated = await db.photo.update({
      where: { id },
      data: {
        albumId,
        isPrivate,
        ...(body.caption !== undefined ? { caption: body.caption || null } : {}),
      },
    })
    if (photo.albumId && photo.albumId !== albumId) {
      await db.album.updateMany({ where: { id: photo.albumId, coverPhotoId: id }, data: { coverPhotoId: null } })
    }
    if (body.isProfile) {
      await setMainPhoto(userId, updated)
      updated = { ...updated, isProfile: true }
    }

    return NextResponse.json({ photo: updated })
  } catch (error) {
    console.error('PATCH /api/photos/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ok = await deleteOwnPhoto(session.user.id, id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/photos/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
