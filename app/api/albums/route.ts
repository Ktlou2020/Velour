import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { ALBUM_DESC_MAX, MAX_ALBUMS, USER_ALBUM_WHERE, USER_SUMMARY_SELECT, albumCards, cleanAlbumName, userSummary } from '@/lib/albums'
import { ACCESS, blockedIdsFor } from '@/lib/media-access'

/**
 * GET /api/albums
 *   → { albums: my albums (with grantedCount, pendingCount),
 *       sharedWithMe: private albums others granted me,
 *       pendingRequests: total requests waiting for my approval }
 */
export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const albums = await albumCards({ ownerId: userId })
    const ids = albums.map((a) => a.id)
    const counts = ids.length
      ? await db.albumAccess.groupBy({ by: ['albumId', 'status'], where: { albumId: { in: ids } }, _count: { _all: true } })
      : []
    const countOf = (albumId: string, status: string) =>
      counts.find((c) => c.albumId === albumId && c.status === status)?._count._all ?? 0

    const blocked = await blockedIdsFor(userId)
    const grants = await db.albumAccess.findMany({
      where: {
        userId,
        status: ACCESS.GRANTED,
        album: { ...USER_ALBUM_WHERE, isPrivate: true, ownerId: { notIn: [userId, ...blocked] }, owner: { isActive: true } },
      },
      select: { albumId: true, updatedAt: true, album: { select: { owner: { select: USER_SUMMARY_SELECT } } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    const sharedCards = grants.length ? await albumCards({ id: { in: grants.map((g) => g.albumId) } }) : []
    const sharedWithMe = grants
      .map((g) => {
        const card = sharedCards.find((c) => c.id === g.albumId)
        return card ? { ...card, owner: userSummary(g.album.owner), grantedAt: g.updatedAt } : null
      })
      .filter(Boolean)

    const withAccess = albums.map((a) => ({
      ...a,
      grantedCount: countOf(a.id, ACCESS.GRANTED),
      pendingCount: countOf(a.id, ACCESS.REQUESTED),
    }))
    return NextResponse.json({
      albums: withAccess,
      sharedWithMe,
      pendingRequests: withAccess.reduce((n, a) => n + a.pendingCount, 0),
    })
  } catch (error) {
    console.error('GET /api/albums error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/albums { name, description?, isPrivate? } */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`album-create:${userId}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const cleaned = cleanAlbumName(body.name)
    if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 })
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, ALBUM_DESC_MAX) || null : null
    const isPrivate = body.isPrivate === true

    const count = await db.album.count({ where: { ownerId: userId, ...USER_ALBUM_WHERE } })
    if (count >= MAX_ALBUMS) return NextResponse.json({ error: `You can have up to ${MAX_ALBUMS} albums` }, { status: 400 })

    const album = await db.album.create({
      data: { ownerId: userId, name: cleaned.name, description, isPrivate, order: count },
    })
    return NextResponse.json({
      album: { ...album, coverUrl: null, photoCount: 0, grantedCount: 0, pendingCount: 0 },
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/albums error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
