import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { ALBUM_DESC_MAX, USER_ALBUM_WHERE, cleanAlbumName, findUserAlbum, userSummary, viewerAlbumState } from '@/lib/albums'
import { entitlements } from '@/lib/plans'

type Ctx = { params: Promise<{ id: string }> }
const notFound = () => NextResponse.json({ error: 'Album not found' }, { status: 404 })

/**
 * GET /api/albums/<id>
 *   owner / public / granted → { album, photos, isOwner, locked: false }
 *   private, no access       → { album (no photos), locked: true, myStatus }
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return notFound()

    const album = await findUserAlbum(id)
    if (!album) return notFound()
    const view = await viewerAlbumState(album, userId, (session.user as { role?: string }).role)
    if (!view) return notFound()

    const photoCount = await db.photo.count({ where: { albumId: id } })
    const base = {
      id: album.id,
      name: album.name,
      description: album.description,
      isPrivate: album.isPrivate,
      coverPhotoId: album.coverPhotoId,
      photoCount,
      owner: userSummary(album.owner),
    }
    if (view.state === 'locked') {
      return NextResponse.json({ album: base, photos: [], isOwner: false, locked: true, myStatus: view.status })
    }
    const photos = await db.photo.findMany({
      where: { albumId: id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, thumbnailUrl: true, caption: true, isProfile: true, isPrivate: true, order: true, createdAt: true },
    })
    return NextResponse.json({ album: base, photos, isOwner: view.state === 'owner', locked: false, myStatus: view.status })
  } catch (error) {
    console.error('GET /api/albums/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH /api/albums/<id> { name?, description?, isPrivate?, coverPhotoId? (string|null), order? } — owner only. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return notFound()
    const album = await findUserAlbum(id)
    if (!album || album.ownerId !== userId) return notFound()

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const data: { name?: string; description?: string | null; isPrivate?: boolean; coverPhotoId?: string | null; order?: number } = {}
    if (body.name !== undefined) {
      const cleaned = cleanAlbumName(body.name)
      if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 })
      data.name = cleaned.name
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== 'string') return NextResponse.json({ error: 'Invalid description' }, { status: 400 })
      data.description = typeof body.description === 'string' ? body.description.trim().slice(0, ALBUM_DESC_MAX) || null : null
    }
    if (typeof body.isPrivate === 'boolean') data.isPrivate = body.isPrivate
    if (body.coverPhotoId !== undefined) {
      if (body.coverPhotoId === null) data.coverPhotoId = null
      else if (isValidId(body.coverPhotoId)) {
        const p = await db.photo.findFirst({ where: { id: body.coverPhotoId, albumId: id }, select: { id: true } })
        if (!p) return NextResponse.json({ error: 'The cover must be a photo in this album' }, { status: 400 })
        data.coverPhotoId = p.id
      } else return NextResponse.json({ error: 'Invalid coverPhotoId' }, { status: 400 })
    }
    if (typeof body.order === 'number' && Number.isInteger(body.order) && body.order >= 0 && body.order < 1000) data.order = body.order

    if (data.isPrivate === true && !album.isPrivate) {
      const owner = await db.user.findUnique({ where: { id: userId }, select: { role: true, profile: { select: { membershipTier: true } } } })
      const maxPrivate = entitlements(owner?.profile?.membershipTier, owner?.role).privateAlbums
      if (maxPrivate !== null) {
        const privateCount = await db.album.count({ where: { ownerId: userId, isPrivate: true, ...USER_ALBUM_WHERE } })
        if (privateCount >= maxPrivate) {
          return NextResponse.json({ error: `Your plan includes ${maxPrivate} private album${maxPrivate === 1 ? '' : 's'}. Upgrade to Gold for unlimited private albums.`, code: 'PRIVATE_ALBUM_LIMIT', limit: maxPrivate, upgrade: true }, { status: 403 })
        }
      }
    }

    if (data.isPrivate === true && !album.isPrivate) {
      const main = await db.photo.findFirst({ where: { albumId: id, isProfile: true }, select: { id: true } })
      if (main) {
        return NextResponse.json({ error: 'This album contains your main photo. Choose a different main photo before making it private.' }, { status: 400 })
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const a = await tx.album.update({ where: { id }, data })
      if (data.isPrivate !== undefined && data.isPrivate !== album.isPrivate) {
        // Photo.isPrivate mirrors the album so every "public photos" query stays correct.
        await tx.photo.updateMany({ where: { albumId: id }, data: { isPrivate: data.isPrivate } })
      }
      return a
    })
    return NextResponse.json({ album: updated })
  } catch (error) {
    console.error('PATCH /api/albums/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/albums/<id> — photos are kept and moved out of the album (keeping their privacy). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return notFound()
    const album = await findUserAlbum(id)
    if (!album || album.ownerId !== userId) return notFound()

    await db.$transaction([
      db.photo.updateMany({ where: { albumId: id }, data: { albumId: null } }),
      db.album.delete({ where: { id } }),
    ])
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/albums/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
