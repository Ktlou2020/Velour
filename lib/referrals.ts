/**
 * Invite-a-friend (server only): "you both get a week of Gold".
 *
 *  - Every member gets a short invite code (getOrCreateReferralCode); the link
 *    is SITE_URL/i/<code>, which drops an `ub_ref` cookie and forwards to
 *    /auth/signup?ref=<code>.
 *  - At sign-up (app/api/register) linkReferral() sets User.referredById and
 *    creates a PENDING Referral. Unknown codes and self-referrals are ignored.
 *  - Once the invited member has confirmed their email AND set a main photo,
 *    maybeRewardReferral() grants both sides their reward, exactly once (the
 *    PENDING → REWARDED claim is a conditional update inside a transaction).
 *    Called from email verification, setMainPhoto, and the cron sweep.
 *
 * Reward per side (grantReward):
 *  - Free member (not a founder / admin), or a member whose Gold comes only
 *    from an earlier invite reward: 7 days of Gold as a Subscription row
 *    { provider 'REFERRAL', period 'week', status 'CANCELLING',
 *    cancelAtPeriodEnd: true }, extended from max(now, current end). The
 *    hourly subscriptions cron (lib/subscriptions.ts expireDue) moves them back
 *    to Free after it lapses + grace, like any non-renewing membership.
 *  - Already Gold/Platinum some other way (paid, founder, admin-set): tier is
 *    left alone; they get BONUS_SUPER_LIKES extra super likes instead.
 *
 * Anti-abuse: no self-referral; at most MONTHLY_CAP rewards per referrer in
 * any rolling 30 days (over-cap referrals stay PENDING and are rewarded by
 * the sweep once there's room); deactivated accounts are REJECTED.
 */
import { randomInt } from 'crypto'
import { Prisma, type MembershipTier } from '@prisma/client'
import { db } from '@/lib/db'
import { escapeHtml, sendBrandedEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { SITE_URL } from '@/app/site'
import { OPEN_STATUSES, formatDate } from '@/lib/subscriptions'

export const REFERRAL_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const REFERRAL_CODE_LENGTH = 7
export const REFERRAL_COOKIE = 'ub_ref'
export const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // seconds
export const REWARD_DAYS = 7
export const MONTHLY_CAP = 10
export const BONUS_SUPER_LIKES = 3
export const REFERRAL_PROVIDER = 'REFERRAL'
export const REFERRAL_NOTICE_TYPE = 'REFERRAL'

const DAY_MS = 24 * 60 * 60 * 1000
const CODE_RE = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`)

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export function generateReferralCode(): string {
  let s = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) s += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)]
  return s
}

/** Canonical form of a code typed/pasted by a person, or null if it can't be one. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.trim().toUpperCase()
  return CODE_RE.test(c) ? c : null
}

export function inviteLink(code: string): string {
  return `${SITE_URL}/i/${code}`
}

/** The member's invite code, creating a unique one on first use. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
  if (!existing) throw new Error('User not found')
  if (existing.referralCode) return existing.referralCode
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode()
    try {
      const set = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } })
      if (set.count === 1) return code
      // Someone else (a concurrent request) set it first — use theirs.
      const now = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
      if (now?.referralCode) return now.referralCode
    } catch (e) {
      if (!isUniqueViolation(e)) throw e // collision with another member's code → retry
    }
  }
  throw new Error('Could not allocate a referral code')
}

/**
 * Link a brand-new member to whoever invited them. Silently ignores unknown
 * codes, self-referral and members who were already linked. Never throws.
 */
export async function linkReferral(newUserId: string, rawCode: unknown): Promise<boolean> {
  try {
    const code = normalizeReferralCode(rawCode)
    if (!code) return false
    const referrer = await db.user.findUnique({ where: { referralCode: code }, select: { id: true, isActive: true } })
    if (!referrer || referrer.id === newUserId || !referrer.isActive) return false
    return await db.$transaction(async (tx) => {
      const set = await tx.user.updateMany({ where: { id: newUserId, referredById: null }, data: { referredById: referrer.id } })
      if (set.count !== 1) return false
      await tx.referral.create({ data: { referrerId: referrer.id, referredId: newUserId, status: 'PENDING' } })
      return true
    })
  } catch (e) {
    if (!isUniqueViolation(e)) console.error('[referrals] link failed:', e instanceof Error ? e.message : e)
    return false
  }
}

export type Grant =
  | { kind: 'GOLD'; until: Date }
  | { kind: 'SUPER_LIKES'; credits: number }

/** Give one member their reward. Runs inside the reward transaction. */
async function grantReward(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<Grant> {
  const u = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { membershipTier: true, foundingMemberNumber: true } } },
  })
  const tier: MembershipTier = u?.profile?.membershipTier ?? 'FREE'
  const founder = u?.profile?.foundingMemberNumber != null
  const [openPaid, openReferral] = await Promise.all([
    tx.subscription.findFirst({ where: { userId, provider: { not: REFERRAL_PROVIDER }, status: { in: OPEN_STATUSES } }, select: { id: true } }),
    tx.subscription.findFirst({ where: { userId, provider: REFERRAL_PROVIDER, status: { in: OPEN_STATUSES } }, orderBy: { currentPeriodEnd: 'desc' } }),
  ])
  const goldEligible = !!u?.profile && !founder && u.role !== 'ADMIN' && !openPaid
    && (tier === 'FREE' || (tier === 'GOLD' && !!openReferral))

  if (!goldEligible) {
    await tx.user.update({ where: { id: userId }, data: { superLikeCredits: { increment: BONUS_SUPER_LIKES } } })
    return { kind: 'SUPER_LIKES', credits: BONUS_SUPER_LIKES }
  }

  const base = openReferral && openReferral.currentPeriodEnd.getTime() > now.getTime() ? openReferral.currentPeriodEnd : now
  const until = new Date(base.getTime() + REWARD_DAYS * DAY_MS)
  if (openReferral) {
    await tx.subscription.update({
      where: { id: openReferral.id },
      // renewalReminderFor reset so the "ends in 3 days" notice fires for the new end date.
      data: { currentPeriodEnd: until, status: 'CANCELLING', cancelAtPeriodEnd: true, renewalReminderFor: null },
    })
  } else {
    await tx.subscription.create({
      data: {
        userId, provider: REFERRAL_PROVIDER, tier: 'GOLD', period: 'week',
        status: 'CANCELLING', cancelAtPeriodEnd: true, cancelledAt: now, currentPeriodEnd: until,
      },
    })
  }
  await tx.profile.updateMany({ where: { userId, membershipTier: { in: ['FREE', 'GOLD'] } }, data: { membershipTier: 'GOLD' } })
  return { kind: 'GOLD', until }
}

export type RewardOutcome =
  | { outcome: 'none' | 'pending' | 'capped' | 'already' | 'rejected' }
  | { outcome: 'rewarded'; referrer: Grant; referred: Grant }

/**
 * Reward the referral of `referredUserId` if it now qualifies (email confirmed
 * + main photo set). Idempotent and safe to call concurrently; never throws.
 */
export async function maybeRewardReferral(referredUserId: string, now = new Date()): Promise<RewardOutcome> {
  try {
    const ref = await db.referral.findUnique({
      where: { referredId: referredUserId },
      select: {
        id: true, status: true, referrerId: true,
        referrer: { select: { isActive: true } },
        referred: { select: { isActive: true, emailVerifiedAt: true, profile: { select: { profilePhoto: true } } } },
      },
    })
    if (!ref) return { outcome: 'none' }
    if (ref.status === 'REWARDED') return { outcome: 'already' }
    if (ref.status !== 'PENDING') return { outcome: 'rejected' }

    if (!ref.referred.isActive || !ref.referrer.isActive || ref.referrerId === referredUserId) {
      await db.referral.updateMany({ where: { id: ref.id, status: 'PENDING' }, data: { status: 'REJECTED' } })
      return { outcome: 'rejected' }
    }
    if (!ref.referred.emailVerifiedAt || !ref.referred.profile?.profilePhoto) return { outcome: 'pending' }

    const result = await db.$transaction(async (tx) => {
      // Serialise rewards touching either member (monthly cap count + subscription
      // extension); locks taken in a fixed order so two rewards can't deadlock.
      for (const id of [ref.referrerId, referredUserId].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'referral:' + id}))`
      }
      const recent = await tx.referral.count({
        where: { referrerId: ref.referrerId, status: 'REWARDED', rewardedAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      })
      if (recent >= MONTHLY_CAP) return { outcome: 'capped' as const }
      const claimed = await tx.referral.updateMany({ where: { id: ref.id, status: 'PENDING' }, data: { status: 'REWARDED', rewardedAt: now } })
      if (claimed.count !== 1) return { outcome: 'already' as const }
      const referrer = await grantReward(tx, ref.referrerId, now)
      const referred = await grantReward(tx, referredUserId, now)
      return { outcome: 'rewarded' as const, referrer, referred }
    }, { timeout: 15_000 })

    if (result.outcome === 'rewarded') {
      await Promise.allSettled([
        notifyRewarded(ref.referrerId, result.referrer, 'referrer'),
        notifyRewarded(referredUserId, result.referred, 'referred'),
      ])
    }
    return result
  } catch (e) {
    console.error('[referrals] reward failed:', e instanceof Error ? e.message : e)
    return { outcome: 'pending' }
  }
}

/** Cron: reward anything the event hooks missed, reject referrals of deactivated accounts. */
export async function sweepReferrals(limit = 200, now = new Date()): Promise<{ checked: number; rewarded: number; rejected: number }> {
  const rejected = await db.referral.updateMany({
    where: { status: 'PENDING', OR: [{ referred: { isActive: false } }, { referrer: { isActive: false } }] },
    data: { status: 'REJECTED' },
  })
  const due = await db.referral.findMany({
    where: { status: 'PENDING', referred: { isActive: true, emailVerifiedAt: { not: null }, profile: { profilePhoto: { not: null } } } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { referredId: true },
  })
  let rewarded = 0
  for (const r of due) {
    const out = await maybeRewardReferral(r.referredId, now)
    if (out.outcome === 'rewarded') rewarded++
  }
  return { checked: due.length, rewarded, rejected: rejected.count }
}

// ─── Notifications ─────────────────────────────────────────────────────────

async function notifyRewarded(userId: string, grant: Grant, side: 'referrer' | 'referred'): Promise<void> {
  try {
    const m = await db.user.findUnique({ where: { id: userId }, select: { email: true, username: true, profile: { select: { displayName: true } } } })
    if (!m) return
    const gift = grant.kind === 'GOLD'
      ? `a week of Gold — yours until ${formatDate(grant.until)}`
      : `${grant.credits} bonus super likes (you’re already a member, so we added these instead)`
    const title = side === 'referrer' ? 'Your invite paid off' : 'Welcome gift unlocked'
    const body = side === 'referrer'
      ? `A friend you invited is all set up. You’ve got ${gift}.`
      : `You’re all set up. Thanks to your invite, you’ve got ${gift}.`
    const url = grant.kind === 'GOLD' ? '/subscription' : '/invite'
    const name = (m.profile?.displayName ?? '').trim().split(' ')[0] || m.username || 'there'
    const P = (h: string) => `<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0 0 12px;">${h}</p>`
    const html = `<p style="color:#ffffff;font-size:16px;margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
      ${P(escapeHtml(body))}
      ${P(escapeHtml('Know someone else who’d fit in? Your invite link is on your Invite page.'))}
      <p style="margin:24px 0 0;"><a href="${escapeHtml(SITE_URL + '/invite')}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;font-size:14px;">Invite more friends</a></p>`
    const results = await Promise.allSettled([
      db.notification.create({ data: { userId, type: REFERRAL_NOTICE_TYPE, title, body, data: { url } } }),
      sendPushToUser(userId, { title, body, url, tag: 'referral' }),
      sendBrandedEmail(m.email, `${title} — Unbound`, title, html),
    ])
    for (const r of results) if (r.status === 'rejected') console.error('[referrals] notify failed:', r.reason instanceof Error ? r.reason.message : r.reason)
  } catch (e) {
    console.error('[referrals] notify error:', e instanceof Error ? e.message : e)
  }
}

// ─── Invite page ───────────────────────────────────────────────────────────

export interface ReferralSummary {
  code: string
  link: string
  stats: { invited: number; joined: number; rewarded: number }
  referrals: { id: string; name: string; status: 'PENDING' | 'REWARDED' | 'REJECTED'; createdAt: Date }[]
}

export async function referralSummary(userId: string): Promise<ReferralSummary> {
  const code = await getOrCreateReferralCode(userId)
  const rows = await db.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, status: true, createdAt: true, referred: { select: { profile: { select: { displayName: true } } } } },
  })
  const [invited, joined, rewarded] = await Promise.all([
    db.referral.count({ where: { referrerId: userId } }),
    db.referral.count({ where: { referrerId: userId, referred: { emailVerifiedAt: { not: null } } } }),
    db.referral.count({ where: { referrerId: userId, status: 'REWARDED' } }),
  ])
  return {
    code,
    link: inviteLink(code),
    // Link clicks aren't tracked: invited = signed up with your link,
    // joined = also confirmed their email, rewarded = fully set up.
    stats: { invited, joined, rewarded },
    referrals: rows.map((r) => ({
      id: r.id,
      name: r.referred.profile?.displayName?.trim() || 'Someone',
      status: (r.status === 'REWARDED' || r.status === 'REJECTED' ? r.status : 'PENDING'),
      createdAt: r.createdAt,
    })),
  }
}
