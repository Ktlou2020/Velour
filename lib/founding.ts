import { db } from '@/lib/db'
import { sendBrandedEmail, escapeHtml } from '@/lib/email'

/**
 * Founding members: the first FOUNDING_MEMBER_LIMIT eligible member accounts
 * (women and couples; admins excluded) get Platinum free, forever, and a
 * numbered "Founding member #N" badge. A spot is claimed when a profile first
 * becomes eligible (sign-up for couples, gender set to Woman in onboarding or
 * profile edits). Numbers are never reused, so a deleted founding account doesn't open
 * a new spot. scripts/backfill.mjs applies the same rule to accounts that
 * existed before this feature (oldest first).
 */
export const FOUNDING_MEMBER_LIMIT = Math.max(0, Number(process.env.FOUNDING_MEMBER_LIMIT ?? 30) || 0)

// Serialises spot claims across concurrent sign-ups (and the startup backfill).
const LOCK_KEY = 74_210_301

/** Who the founding offer is for: women and couples. */
export function isFoundingEligible(p: { gender: string | null; isCouple: boolean }): boolean {
  return p.isCouple || p.gender === 'WOMAN'
}

/** Claim a spot if eligible and email the welcome. Never throws (call after profile saves). */
export async function maybeClaimFounding(userId: string): Promise<void> {
  try {
    const number = await claimFoundingSpot(userId)
    if (!number) return
    const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, username: true, profile: { select: { displayName: true } } } })
    if (u) await sendFoundingWelcome(u.email, u.profile?.displayName || u.username, number)
  } catch (e) {
    console.error('Founding spot claim failed:', e instanceof Error ? e.message : e)
  }
}

export async function foundingSpots(): Promise<{ limit: number; claimed: number; left: number }> {
  const agg = await db.profile.aggregate({ _max: { foundingMemberNumber: true } })
  const claimed = Math.min(FOUNDING_MEMBER_LIMIT, agg._max.foundingMemberNumber ?? 0)
  return { limit: FOUNDING_MEMBER_LIMIT, claimed, left: Math.max(0, FOUNDING_MEMBER_LIMIT - claimed) }
}

/**
 * Give `userId` the next founding spot if one is left. Returns the number, or
 * null (no spots left, admin account, or already a founding member).
 */
export async function claimFoundingSpot(userId: string): Promise<number | null> {
  if (FOUNDING_MEMBER_LIMIT === 0) return null
  const number = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`)
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, isDemo: true, profile: { select: { foundingMemberNumber: true, gender: true, isCouple: true } } },
    })
    if (!user?.profile || user.role === 'ADMIN' || user.isDemo || !user.isActive || user.profile.foundingMemberNumber != null) return null
    if (!isFoundingEligible(user.profile)) return null
    const agg = await tx.profile.aggregate({ _max: { foundingMemberNumber: true } })
    const next = (agg._max.foundingMemberNumber ?? 0) + 1
    if (next > FOUNDING_MEMBER_LIMIT) return null
    await tx.profile.update({
      where: { userId },
      data: { foundingMemberNumber: next, membershipTier: 'PLATINUM' },
    })
    await tx.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: `You're founding member #${next} 👑`,
        body: 'As one of our first members you get Platinum free, forever. Thank you for being here from the start.',
        data: { url: '/subscription' },
      },
    })
    return next
  })
  return number
}

/** Welcome email for a new founding member (best effort). */
export async function sendFoundingWelcome(email: string, name: string, number: number): Promise<void> {
  await sendBrandedEmail(
    email,
    `You're Unbound founding member #${number}`,
    'Founding member',
    `<h2 style="color:#ffffff; font-family:'Georgia',serif; font-size:24px; margin:0 0 16px;">Welcome, founding member #${number} 👑</h2>
     <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 16px;">
       Hi ${escapeHtml(name)}, you're one of the first ${FOUNDING_MEMBER_LIMIT} women and couples on Unbound — so Platinum is yours, free, forever.
       Incognito browsing, weekly boosts, unlimited messages and everything else is already switched on.
     </p>
     <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0;">Thank you for helping us build something special.</p>`,
  )
}
