import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { findUserAlbum, viewerAlbumState } from '@/lib/albums'
import { ACCESS, displayNameOf, notify } from '@/lib/media-access'

const DECLINE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** POST /api/albums/<id>/request — ask the owner for access to a private album. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    const album = await findUserAlbum(id)
    if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    const view = await viewerAlbumState(album, me)
    if (!view) return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    if (view.state === 'owner') return NextResponse.json({ error: 'This is your album' }, { status: 400 })
    if (view.state === 'open') return NextResponse.json({ status: view.status ?? ACCESS.GRANTED })

    if (view.status === ACCESS.REQUESTED) return NextResponse.json({ status: ACCESS.REQUESTED })
    if (!rateLimit(`album-request:${me}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }
    if (view.status === ACCESS.DECLINED) {
      const row = await db.albumAccess.findUnique({ where: { albumId_userId: { albumId: id, userId: me } }, select: { updatedAt: true } })
      if (row && Date.now() - row.updatedAt.getTime() < DECLINE_COOLDOWN_MS) {
        return NextResponse.json({ error: 'Your last request wasn’t accepted. You can ask again in a few days.', status: ACCESS.DECLINED }, { status: 409 })
      }
    }

    await db.albumAccess.upsert({
      where: { albumId_userId: { albumId: id, userId: me } },
      create: { albumId: id, userId: me, status: ACCESS.REQUESTED },
      update: { status: ACCESS.REQUESTED },
    })
    const requester = await displayNameOf(me)
    await notify(album.ownerId, {
      type: 'ALBUM_REQUEST',
      title: 'Private album request',
      body: `${requester.name} (@${requester.username}) asked to see your private album “${album.name}”.`,
      url: `/gallery?tab=albums&album=${id}&share=1`,
      data: { albumId: id, fromUsername: requester.username },
    })
    return NextResponse.json({ status: ACCESS.REQUESTED }, { status: 201 })
  } catch (error) {
    console.error('POST /api/albums/[id]/request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
