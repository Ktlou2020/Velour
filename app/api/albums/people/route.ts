import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { USER_SUMMARY_SELECT, userSummary } from '@/lib/albums'
import { blockedIdsFor } from '@/lib/media-access'

/**
 * GET /api/albums/people?q=… — who I can share an album with: my matches and
 * chat partners whose username / name matches, plus an exact username match.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`album-people:${me}`, 120, 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/^@/, '').slice(0, 40)

    const blocked = await blockedIdsFor(me)
    const [matches, convs] = await Promise.all([
      db.match.findMany({
        where: { OR: [{ user1Id: me }, { user2Id: me }] },
        select: { user1Id: true, user2Id: true },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      db.conversationParticipant.findMany({
        where: { conversation: { participants: { some: { userId: me } } }, userId: { not: me } },
        select: { userId: true },
        take: 300,
      }),
    ])
    const known = new Set<string>([
      ...matches.map((m) => (m.user1Id === me ? m.user2Id : m.user1Id)),
      ...convs.map((c) => c.userId),
    ])
    blocked.forEach((b) => known.delete(b))
    known.delete(me)

    const textFilter = q
      ? { OR: [
          { username: { contains: q, mode: 'insensitive' as const } },
          { profile: { displayName: { contains: q, mode: 'insensitive' as const } } },
        ] }
      : {}
    const people = known.size
      ? await db.user.findMany({
          where: { id: { in: [...known] }, isActive: true, ...textFilter },
          select: USER_SUMMARY_SELECT,
          take: 8,
        })
      : []

    if (q.length >= 3 && !people.some((p) => p.username.toLowerCase() === q.toLowerCase())) {
      const exact = await db.user.findFirst({
        where: { username: { equals: q, mode: 'insensitive' }, isActive: true, id: { notIn: [me, ...blocked] } },
        select: USER_SUMMARY_SELECT,
      })
      if (exact) people.unshift(exact)
    }
    return NextResponse.json({ people: people.slice(0, 8).map(userSummary) })
  } catch (error) {
    console.error('GET /api/albums/people error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
