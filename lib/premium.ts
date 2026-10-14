/**
 * Older premium helpers, now thin wrappers over lib/plans.ts (the single
 * source of truth for entitlements). Pure module — no DB access — so it is
 * safe to import from client and server code alike.
 */
import type { MembershipTier } from '@prisma/client'
import { entitlements, planFor } from '@/lib/plans'

export type Tier = MembershipTier | null | undefined

const DAY_MS = 24 * 60 * 60 * 1000

/** Gold, Platinum or admin. */
export function isPaid(tier: Tier, role?: string | null): boolean {
  return planFor(tier, role) !== 'FREE'
}

/** Platinum or admin. */
export function isPlatinum(tier: Tier, role?: string | null): boolean {
  return planFor(tier, role) === 'PLATINUM'
}

export const BOOST_DURATION_MS = 30 * 60 * 1000

/** Boost cooldown from the plan (Gold: 30 days, Platinum: 7 days); null = no boosts. */
export function boostCooldownMs(tier: Tier, role?: string | null): number | null {
  const days = entitlements(tier, role).boostEveryDays
  return days === null ? null : days * DAY_MS
}

export function nextBoostAvailableAt(lastBoostAt: Date | null | undefined, tier: Tier, role?: string | null): Date | null {
  const cooldown = boostCooldownMs(tier, role)
  if (cooldown === null) return null
  if (!lastBoostAt) return new Date(0)
  return new Date(new Date(lastBoostAt).getTime() + cooldown)
}

export function isBoosted(boostedUntil: Date | string | null | undefined): boolean {
  return !!boostedUntil && new Date(boostedUntil).getTime() > Date.now()
}

/** Travel mode is live when a destination is set and travelUntil is in the future. */
export function isTravelling(p: { travelCity?: string | null; travelUntil?: Date | string | null } | null | undefined): boolean {
  return !!p?.travelCity && !!p.travelUntil && new Date(p.travelUntil).getTime() > Date.now()
}
