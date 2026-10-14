import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { PLANS } from '@/lib/plans'
import {
  cityWhere, getBlockedIds, getCallerContext, hashString, memberSelect, mutualInterestWhere, notSnoozed, toMemberResult,
} from '@/app/api/members/search'
import { trustAdjustedCompat } from '@/lib/reviews'

const POOL_SIZE = 200

/**
 * GET /api/picks — today's top-compatibility members for the caller.
 * Count comes from the plan (lib/plans.ts → dailyPicks: Free 5, Gold 10,
 * Platinum 15). Candidates are the 200 most recently active eligible members;
 * scored with lib/compat (adjusted by the review trust score) and tie-broken by a hash of caller + candidate + date
 * so the order is stable through the day. Only mutually interested members
 * are considered. While travel mode is live, picks come from the destination
 * first (topped up from everywhere if the destination is quiet).
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
    const count = caller.ent.dailyPicks

    const [blockedIds, actions] = await Promise.all([
      getBlockedIds(userId),
      db.like.findMany({ where: { fromUserId: userId }, select: { toUserId: true } }),
    ])
    const excludedIds = [...blockedIds, ...actions.map((a) => a.toUserId)]
    const baseProfile = [notSnoozed(), ...mutualInterestWhere(caller)]

    const findPool = (extra: string | null, notIn: string[], take: number) =>
      db.user.findMany({
        where: {
          id: { not: userId, notIn },
          isActive: true,
          profile: { AND: extra ? [...baseProfile, cityWhere(extra)] : baseProfile },
        },
        select: memberSelect,
        orderBy: [{ profile: { lastSeen: 'desc' } }, { id: 'asc' }],
        take,
      })

    let pool = await findPool(caller.travel?.city ?? null, excludedIds, POOL_SIZE)
    if (caller.travel && pool.length < count) {
      pool = [...pool, ...(await findPool(null, [...excludedIds, ...pool.map((p) => p.id)], POOL_SIZE))]
    }

    const day = new Date().toISOString().slice(0, 10)
    const travelCity = caller.travel?.city.toLowerCase()
    const picks = pool
      .map((u) => {
        const member = toMemberResult(u, caller)
        const inDestination = !!travelCity && (member.city ?? '').toLowerCase().includes(travelCity)
        // Compatibility, adjusted by the review trust score (lib/reviews.ts)
        const score = trustAdjustedCompat(member.compatibility, u.profile?.ratingAvg, u.profile?.ratingCount)
        return { member, inDestination, score, tie: hashString(`${userId}:${u.id}:${day}`) }
      })
      // Stay within the plan's search radius (members without a location still qualify)
      .filter((p) => caller.ent.maxSearchRadiusKm === null || p.member.distanceKm === undefined || p.member.distanceKm <= caller.ent.maxSearchRadiusKm)
      .sort((a, b) =>
        Number(b.inDestination) - Number(a.inDestination) ||
        b.score - a.score ||
        a.tie - b.tie)
      .slice(0, count)
      .map((p) => p.member)

    const nextTier = caller.tier === 'FREE' ? 'GOLD' : caller.tier === 'GOLD' ? 'PLATINUM' : null
    return NextResponse.json({
      picks,
      limit: count,
      isPaid: caller.paid,
      tier: caller.tier,
      nextTier,
      nextTierPicks: nextTier ? PLANS[nextTier].dailyPicks : null,
      travel: caller.travel ? { city: caller.travel.city, until: caller.travel.until } : null,
      date: day,
    })
  } catch (error) {
    console.error('GET /api/picks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
