import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { albumCards, userSummary, USER_SUMMARY_SELECT } from '@/lib/albums'
import { isBlockedBetween } from '@/lib/media-access'

/**
 * GET /api/albums/user/<username> — a member's albums as the viewer sees them:
 * public albums open, private ones locked (cover hidden) unless access was granted.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { username } = await params
    const name = decodeURIComponent(username).trim()
    if (!name || name.length > 40) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const owner = await db.user.findFirst({
      where: { username: { equals: name, mode: 'insensitive' }, isActive: true },
      select: USER_SUMMARY_SELECT,
    })
    if (!owner || (await isBlockedBetween(me, owner.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isOwner = owner.id === me
    const isAdmin = (session.user as { role?: string }).role === 'ADMIN'
    const cards = (await albumCards({ ownerId: owner.id })).filter((a) => a.photoCount > 0 || isOwner)
    const access = await db.albumAccess.findMany({
      where: { userId: me, albumId: { in: cards.map((c) => c.id) } },
      select: { albumId: true, status: true },
    })
    const statusOf = new Map(access.map((a) => [a.albumId, a.status]))

    const albums = cards.map((a) => {
      const myStatus = statusOf.get(a.id) ?? null
      const locked = a.isPrivate && !isOwner && !isAdmin && myStatus !== 'GRANTED'
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        isPrivate: a.isPrivate,
        photoCount: a.photoCount,
        coverUrl: locked ? null : a.coverUrl,
        locked,
        myStatus,
      }
    })
    return NextResponse.json({ owner: userSummary(owner), isOwner, albums })
  } catch (error) {
    console.error('GET /api/albums/user/[username] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
