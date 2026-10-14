import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { findUserAlbum } from '@/lib/albums'
import { ACCESS, displayNameOf, isBlockedBetween, notify } from '@/lib/media-access'

type Ctx = { params: Promise<{ id: string; userId: string }> }
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })

/** PATCH /api/albums/<id>/access/<userId> { action: "approve" | "decline" } — owner answers a request. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, userId } = await params
    if (!isValidId(id) || !isValidId(userId)) return notFound()
    const album = await findUserAlbum(id)
    if (!album || album.ownerId !== me) return notFound()

    const body = await req.json().catch(() => null) as { action?: unknown } | null
    const action = body?.action
    if (action !== 'approve' && action !== 'decline') {
      return NextResponse.json({ error: 'action must be "approve" or "decline"' }, { status: 400 })
    }
    const row = await db.albumAccess.findUnique({ where: { albumId_userId: { albumId: id, userId } } })
    if (!row || row.status !== ACCESS.REQUESTED) return NextResponse.json({ error: 'No pending request from this member' }, { status: 404 })

    if (action === 'approve') {
      if (await isBlockedBetween(me, userId)) return notFound()
      await db.albumAccess.update({ where: { id: row.id }, data: { status: ACCESS.GRANTED } })
      const owner = await displayNameOf(me)
      await notify(userId, {
        type: 'ALBUM_GRANTED',
        title: 'Access granted',
        body: `${owner.name} approved your request to see “${album.name}”.`,
        url: `/gallery?tab=shared&album=${id}`,
        data: { albumId: id, fromUsername: owner.username },
      })
      return NextResponse.json({ status: ACCESS.GRANTED })
    }
    // Declines are silent; the member may ask again after a cool-down.
    await db.albumAccess.update({ where: { id: row.id }, data: { status: ACCESS.DECLINED } })
    return NextResponse.json({ status: ACCESS.DECLINED })
  } catch (error) {
    console.error('PATCH /api/albums/[id]/access/[userId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/albums/<id>/access/<userId>
 *   owner → revoke that member's access (or withdraw a request)
 *   the member themself → leave the album / cancel their request
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, userId } = await params
    if (!isValidId(id) || !isValidId(userId)) return notFound()
    const album = await findUserAlbum(id)
    if (!album || (album.ownerId !== me && userId !== me)) return notFound()

    const { count } = await db.albumAccess.deleteMany({ where: { albumId: id, userId } })
    if (!count) return notFound()
    return NextResponse.json({ removed: true })
  } catch (error) {
    console.error('DELETE /api/albums/[id]/access/[userId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
