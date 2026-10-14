import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { BOOST_DURATION_MS, isBoosted, nextBoostAvailableAt } from '@/lib/premium'
import { entitlements } from '@/lib/plans'

async function loadState(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      profile: { select: { membershipTier: true, boostedUntil: true, lastBoostAt: true } },
    },
  })
  const tier = user?.profile?.membershipTier ?? 'FREE'
  const role = user?.role ?? null
  // Boosts come from the plan (lib/plans.ts → boostEveryDays; null = no boosts)
  const ent = entitlements(tier, role)
  const paid = ent.boostEveryDays !== null
  const boostedUntil = user?.profile?.boostedUntil ?? null
  const active = isBoosted(boostedUntil)
  const lastBoostAt = user?.profile?.lastBoostAt ?? null
  const nextAt = paid ? nextBoostAvailableAt(lastBoostAt, tier, role) : null
  const canBoost = paid && !active && !!nextAt && nextAt.getTime() <= Date.now()
  return {
    hasProfile: !!user?.profile,
    tier,
    role,
    lastBoostAt,
    public: {
      paid,
      boostedUntil: active ? boostedUntil : null,
      nextAvailableAt: nextAt && nextAt.getTime() > Date.now() ? nextAt : null,
      canBoost,
      everyDays: ent.boostEveryDays,
    },
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const state = await loadState(session.user.id)
    return NextResponse.json(state.public)
  } catch (error) {
    console.error('GET /api/boost error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const state = await loadState(session.user.id)
    if (!state.public.paid) {
      return NextResponse.json({ error: 'Profile boosts are available on Gold and Platinum', upgrade: true }, { status: 403 })
    }
    if (!state.hasProfile) {
      return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })
    }
    if (state.public.boostedUntil) {
      return NextResponse.json({ error: 'Your profile is already boosted', ...state.public }, { status: 409 })
    }
    if (!state.public.canBoost) {
      return NextResponse.json({ error: 'Your next boost is not available yet', ...state.public }, { status: 429 })
    }

    const now = new Date()
    const boostedUntil = new Date(now.getTime() + BOOST_DURATION_MS)
    // Only apply if lastBoostAt is unchanged since we checked (guards double-submits)
    const result = await db.profile.updateMany({
      where: { userId: session.user.id, lastBoostAt: state.lastBoostAt },
      data: { boostedUntil, lastBoostAt: now },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Boost already in progress' }, { status: 409 })
    }

    return NextResponse.json({
      paid: true,
      boostedUntil,
      nextAvailableAt: nextBoostAvailableAt(now, state.tier, state.role),
      canBoost: false,
      everyDays: entitlements(state.tier, state.role).boostEveryDays,
    })
  } catch (error) {
    console.error('POST /api/boost error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
