import type { MembershipTier } from '@prisma/client'

export type Tier = MembershipTier | null | undefined

export function isPaid(tier: Tier, role?: string | null): boolean {
  return role === 'ADMIN' || tier === 'GOLD' || tier === 'PLATINUM'
}

export function isPlatinum(tier: Tier, role?: string | null): boolean {
  return role === 'ADMIN' || tier === 'PLATINUM'
}

export const BOOST_DURATION_MS = 30 * 60 * 1000

/** Gold: one boost per 30 days. Platinum: one boost per 7 days. */
export function boostCooldownMs(tier: Tier, role?: string | null): number | null {
  if (isPlatinum(tier, role)) return 7 * 24 * 60 * 60 * 1000
  if (isPaid(tier, role)) return 30 * 24 * 60 * 60 * 1000
  return null
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
