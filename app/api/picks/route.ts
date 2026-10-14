import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getBlockedIds, getCallerContext, memberSelect, mutualInterestWhere, notSnoozed, toMemberResult } from '@/app/api/members/search'

const POOL_SIZE = 200
const FREE_PICKS = 5
const PAID_PICKS = 10

/** Small deterministic string hash (FNV-1a) used to tie-break picks per day. */
function hash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * GET /api/picks — today's top-compatibility members for the caller.
 * FREE: 5 picks, GOLD/PLATINUM: 10. Candidates are the 200 most recently active
 * eligible members; scored with lib/compat and tie-broken by a hash of
 * caller + candidate + date so the order is stable through the day.
 * Only mutually interested members are considered.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const role = (session.user as { role?: string }).role
    const caller = await getCallerContext(userId, role)
    const count = caller.paid ? PAID_PICKS : FREE_PICKS

    const [blockedIds, actions] = await Promise.all([
      getBlockedIds(userId),
      db.like.findMany({ where: { fromUserId: userId }, select: { toUserId: true } }),
    ])
    const excludedIds = [...blockedIds, ...actions.map((a) => a.toUserId)]

    const pool = await db.user.findMany({
      where: {
        id: { not: userId, notIn: excludedIds },
        isActive: true,
        // Only people who would like to meet each other (lib/identity rules)
        profile: { AND: [notSnoozed(), ...mutualInterestWhere(caller)] },
      },
      select: memberSelect,
      orderBy: [{ profile: { lastSeen: 'desc' } }, { id: 'asc' }],
      take: POOL_SIZE,
    })

    const day = new Date().toISOString().slice(0, 10)
    const picks = pool
      .map((u) => ({ member: toMemberResult(u, caller), tie: hash(`${userId}:${u.id}:${day}`) }))
      .sort((a, b) => b.member.compatibility - a.member.compatibility || a.tie - b.tie)
      .slice(0, count)
      .map((p) => p.member)

    return NextResponse.json({ picks, limit: count, isPaid: caller.paid, date: day })
  } catch (error) {
    console.error('GET /api/picks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
