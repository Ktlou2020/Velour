/**
 * Lifecycle email (welcome, profile nudge, likes digest, unread messages,
 * win-back). Run by /api/cron/lifecycle every 15 minutes; idempotent.
 *
 *  - Only to active members with a confirmed email who haven't opted out
 *    (User.emailMarketingOptOut) and aren't snoozed.
 *  - Only between 08:00 and 21:00 SAST; outside that window a run sends nothing.
 *  - De-duplicated through EmailLog (userId, kind, key): the row is written
 *    before sending, so two overlapping runs can't double-send; if the send
 *    fails the row is removed so the next run retries.
 *  - At most LIFECYCLE_BATCH_LIMIT (default 200) emails per run, oldest-eligible
 *    first, to stay inside Brevo's rate limits.
 *  - Every email ends with a one-click unsubscribe link (signed, no login).
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { escapeHtml, sendBrandedEmail } from '@/lib/email'
import { entitlements } from '@/lib/plans'
import { SITE_URL } from '@/app/site'

export type LifecycleKind = 'WELCOME_1' | 'PROFILE_NUDGE' | 'LIKES_DIGEST' | 'UNREAD_MESSAGES' | 'WIN_BACK'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const SAST_OFFSET = 2 * HOUR // South Africa: UTC+2, no DST

// ─── Unsubscribe tokens ────────────────────────────────────────────────────

function unsubscribeSecret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is not configured')
  return s
}

/** HMAC-SHA256(userId) with NEXTAUTH_SECRET, base64url. */
export function unsubscribeToken(userId: string): string {
  return createHmac('sha256', unsubscribeSecret()).update(`unsubscribe:${userId}`).digest('base64url')
}

export function verifyUnsubscribeToken(userId: unknown, token: unknown): boolean {
  if (typeof userId !== 'string' || typeof token !== 'string' || !userId || !token || userId.length > 100) return false
  let expected: Buffer
  try {
    expected = Buffer.from(unsubscribeToken(userId))
  } catch {
    return false
  }
  const given = Buffer.from(token)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const tokenQuery = (userId: string) => `u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`

/** Page link shown in the email footer. */
export function unsubscribeUrl(userId: string): string {
  return `${SITE_URL}/unsubscribe?${tokenQuery(userId)}`
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header (POST). */
export function oneClickUnsubscribeUrl(userId: string): string {
  return `${SITE_URL}/api/unsubscribe?${tokenQuery(userId)}`
}

// ─── Time helpers (SAST) ───────────────────────────────────────────────────

function sast(now: Date) {
  const local = new Date(now.getTime() + SAST_OFFSET)
  const iso = local.toISOString()
  return { hour: local.getUTCHours(), date: iso.slice(0, 10), month: iso.slice(0, 7) }
}

/** True between 08:00 and 21:00 Africa/Johannesburg. */
export function inSendWindow(now = new Date()): boolean {
  const h = sast(now).hour
  return h >= 8 && h < 21
}

// ─── Building blocks ───────────────────────────────────────────────────────

const H = (text: string) =>
  `<h2 style="color:#ffffff;font-family:'Georgia',serif;font-size:22px;margin:0 0 16px;">${text}</h2>`
const P = (html: string) => `<p style="color:#d0d0d8;font-size:15px;line-height:1.7;margin:0 0 14px;">${html}</p>`
const GOLD = (html: string) => `<p style="color:#D4AF37;font-size:14px;line-height:1.6;margin:0 0 14px;">${html}</p>`
const LIST = (items: string[]) =>
  `<ul style="color:#d0d0d8;font-size:15px;line-height:1.8;margin:0 0 14px;padding-left:20px;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
const BUTTON = (label: string, path: string) =>
  `<div style="text-align:center;margin:28px 0 8px;"><a href="${escapeHtml(SITE_URL + path)}" style="display:inline-block;background:linear-gradient(135deg,#DC143C,#8F0D25);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">${escapeHtml(label)}</a></div>`

function footer(userId: string): string {
  return `<p style="color:#666677;font-size:12px;line-height:1.6;margin:28px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
You're getting this because you're a member of Unbound. We keep these emails rare and never share their contents.
<a href="${escapeHtml(unsubscribeUrl(userId))}" style="color:#DC143C;text-decoration:none;">Unsubscribe</a>
&nbsp;·&nbsp;<a href="${escapeHtml(SITE_URL + '/account')}" style="color:#DC143C;text-decoration:none;">Email settings</a></p>`
}

function firstName(u: { username: string; profile: { displayName: string | null } | null }): string {
  return (u.profile?.displayName ?? '').trim().split(/\s+/)[0] || u.username || 'there'
}
const hi = (u: Parameters<typeof firstName>[0]) => P(`Hi ${escapeHtml(firstName(u))},`)

// ─── sendOnce ──────────────────────────────────────────────────────────────

export interface BuiltEmail {
  to: string
  subject: string
  title: string
  bodyHtml: string
}

export type SendResult = 'sent' | 'skipped' | 'failed'

/**
 * Claim (userId, kind, key) in EmailLog, then send. Already claimed → 'skipped'.
 * `build` may return null to skip (the claim is released). A failed send
 * releases the claim so the next run retries.
 */
export async function sendOnce(
  userId: string,
  kind: LifecycleKind | string,
  key: string,
  build: () => Promise<BuiltEmail | null> | BuiltEmail | null,
  now = new Date(),
): Promise<SendResult> {
  let logId: string
  try {
    const row = await db.emailLog.create({ data: { userId, kind, key, createdAt: now }, select: { id: true } })
    logId = row.id
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'skipped'
    throw e
  }
  const release = () => db.emailLog.delete({ where: { id: logId } }).catch(() => {})
  try {
    const email = await build()
    if (!email) {
      await release()
      return 'skipped'
    }
    const body = email.bodyHtml + footer(userId)
    await sendBrandedEmail(email.to, email.subject, email.title, body, {
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl(userId)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    return 'sent'
  } catch (e) {
    console.error(`[lifecycle] ${kind} for ${userId} failed:`, e instanceof Error ? e.message : e)
    await release()
    return 'failed'
  }
}

// ─── Eligibility ───────────────────────────────────────────────────────────

/** Active, confirmed, opted in, not snoozed. */
function reachable(now: Date): Prisma.UserWhereInput {
  return {
    isActive: true,
    emailMarketingOptOut: false,
    emailVerifiedAt: { not: null },
    NOT: { profile: { is: { isSnoozed: true, OR: [{ snoozedUntil: null }, { snoozedUntil: { gt: now } }] } } },
  }
}

const memberSelect = {
  id: true,
  email: true,
  username: true,
  role: true,
  createdAt: true,
  profile: {
    select: {
      displayName: true,
      profilePhoto: true,
      profileCompleteness: true,
      lastSeen: true,
      membershipTier: true,
      foundingMemberNumber: true,
      city: true,
    },
  },
} satisfies Prisma.UserSelect
type Member = Prisma.UserGetPayload<{ select: typeof memberSelect }>

async function blockedWith(userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId))
}

// ─── Emails ────────────────────────────────────────────────────────────────

type Counts = { sent: number; skipped: number; failed: number }
const zero = (): Counts => ({ sent: 0, skipped: 0, failed: 0 })

class Budget {
  constructor(public left: number) {}
  get done() {
    return this.left <= 0
  }
}

async function tally(c: Counts, budget: Budget, p: Promise<SendResult>) {
  const r = await p
  c[r]++
  if (r === 'sent') budget.left--
}

/** WELCOME_1: once, ≥10 min after confirming email, for members who joined in the last 2 days. */
async function welcome(now: Date, budget: Budget): Promise<Counts> {
  const c = zero()
  if (budget.done) return c
  const users = await db.user.findMany({
    where: {
      ...reachable(now),
      emailVerifiedAt: { not: null, lte: new Date(now.getTime() - 10 * MIN) },
      createdAt: { gte: new Date(now.getTime() - 2 * DAY) },
      emailLogs: { none: { kind: 'WELCOME_1' } },
    },
    orderBy: { emailVerifiedAt: 'asc' },
    take: budget.left,
    select: memberSelect,
  })
  for (const u of users) {
    if (budget.done) break
    await tally(c, budget, sendOnce(u.id, 'WELCOME_1', 'once', () => welcomeEmail(u), now))
  }
  return c
}

function welcomeEmail(u: Member): BuiltEmail {
  const founding = u.profile?.foundingMemberNumber
  return {
    to: u.email,
    subject: 'Welcome to Unbound',
    title: 'Welcome',
    bodyHtml:
      H('You’re in. Welcome to Unbound.') +
      hi(u) +
      P('Three small steps make all the difference:') +
      LIST([
        '<strong style="color:#fff;">Add a photo</strong> — profiles with a photo get far more attention.',
        '<strong style="color:#fff;">Tell your story</strong> — a few lines and what you’re open to.',
        '<strong style="color:#fff;">Explore Discover</strong> — like, wink, and see who’s nearby.',
      ]) +
      (founding ? GOLD(`As Founding Member #${founding}, you’re part of the circle that shapes Unbound. Thank you.`) : '') +
      P('Your privacy comes first — you choose what to share, and with whom.') +
      BUTTON('Complete your profile', '/profile'),
  }
}

/** PROFILE_NUDGE: once, 2–5 days after sign-up, if there's no photo or the profile is under 60% complete. */
async function profileNudge(now: Date, budget: Budget): Promise<Counts> {
  const c = zero()
  if (budget.done) return c
  const users = await db.user.findMany({
    where: {
      AND: [
        reachable(now),
        {
          createdAt: { gte: new Date(now.getTime() - 5 * DAY), lte: new Date(now.getTime() - 2 * DAY) },
          emailLogs: { none: { kind: 'PROFILE_NUDGE' } },
        },
        {
          OR: [
            { profile: { is: null } },
            { profile: { is: { OR: [{ profilePhoto: null }, { profilePhoto: '' }, { profileCompleteness: { lt: 60 } }] } } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: budget.left,
    select: memberSelect,
  })
  for (const u of users) {
    if (budget.done) break
    await tally(c, budget, sendOnce(u.id, 'PROFILE_NUDGE', 'once', () => nudgeEmail(u), now))
  }
  return c
}

function nudgeEmail(u: Member): BuiltEmail {
  const noPhoto = !u.profile?.profilePhoto
  return {
    to: u.email,
    subject: noPhoto ? 'Add a photo — let them see you' : 'Your profile is almost there',
    title: 'Your profile',
    bodyHtml:
      H(noPhoto ? 'Let them see you' : 'Almost there') +
      hi(u) +
      P(
        noPhoto
          ? 'Members with a profile photo get noticed far more often. Add one in a minute — you can keep extras in a private album.'
          : 'A few more details help the right people find you. Add a line about yourself and what you’re open to.',
      ) +
      BUTTON(noPhoto ? 'Add a photo' : 'Finish my profile', '/profile'),
  }
}

/**
 * LIKES_DIGEST (key = SAST date): at most every 2 days, when there's ≥1 new
 * like/super like/wink since the last digest (or in the last 48h) and the member
 * hasn't been on the site in 12h. Names up to 3 likers only for members whose
 * plan includes seeWhoLikedYou.
 */
async function likesDigest(now: Date, budget: Budget): Promise<Counts> {
  const c = zero()
  if (budget.done) return c
  const windowStart = new Date(now.getTime() - 48 * HOUR)
  const recent = await db.like.groupBy({
    by: ['toUserId'],
    where: { type: { not: 'PASS' }, createdAt: { gte: windowStart, lte: now }, fromUser: { isActive: true } },
    _min: { createdAt: true },
  })
  if (recent.length === 0) return c
  const firstLikeAt = new Map(recent.map((r) => [r.toUserId, r._min.createdAt?.getTime() ?? 0]))
  const { date } = sast(now)
  const users = await db.user.findMany({
    where: {
      AND: [
        reachable(now),
        {
          id: { in: [...firstLikeAt.keys()] },
          profile: { is: { lastSeen: { lt: new Date(now.getTime() - 12 * HOUR) } } },
          emailLogs: { none: { kind: 'LIKES_DIGEST', OR: [{ createdAt: { gte: windowStart } }, { key: date }] } },
        },
      ],
    },
    select: memberSelect,
  })
  users.sort((a, b) => (firstLikeAt.get(a.id) ?? 0) - (firstLikeAt.get(b.id) ?? 0))
  for (const u of users) {
    if (budget.done) break
    await tally(c, budget, sendOnce(u.id, 'LIKES_DIGEST', date, () => likesEmail(u, now, windowStart), now))
  }
  return c
}

async function likesEmail(u: Member, now: Date, windowStart: Date): Promise<BuiltEmail | null> {
  const last = await db.emailLog.findFirst({
    where: { userId: u.id, kind: 'LIKES_DIGEST', createdAt: { lt: now } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const since = last && last.createdAt > windowStart ? last.createdAt : windowStart
  const [blocked, myActions] = await Promise.all([
    blockedWith(u.id),
    db.like.findMany({ where: { fromUserId: u.id }, select: { toUserId: true } }),
  ])
  const where: Prisma.LikeWhereInput = {
    toUserId: u.id,
    type: { not: 'PASS' },
    createdAt: { gt: since, lte: now },
    fromUserId: { notIn: [...blocked, ...myActions.map((a) => a.toUserId)] },
    fromUser: { isActive: true },
  }
  const n = await db.like.count({ where })
  if (n === 0) return null

  const canSee = entitlements(u.profile?.membershipTier, u.role).seeWhoLikedYou
  let who = ''
  if (canSee) {
    const rows = await db.like.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { fromUser: { select: { username: true, profile: { select: { displayName: true } } } } },
    })
    const names = rows.map((r) => escapeHtml(r.fromUser.profile?.displayName?.trim() || r.fromUser.username))
    const more = n - names.length
    who =
      names.length === 1 && more === 0
        ? `<strong style="color:#fff;">${names[0]}</strong> is waiting to hear back.`
        : `Including <strong style="color:#fff;">${names.join(', ')}</strong>${more > 0 ? ` and ${more} more` : ''}.`
  }
  const plural = n === 1 ? 'new like' : 'new likes'
  return {
    to: u.email,
    subject: `You have ${n} ${plural} on Unbound`,
    title: 'New likes',
    bodyHtml:
      H(`You have ${n} ${plural}`) +
      hi(u) +
      P(n === 1 ? 'Someone noticed you while you were away.' : 'People noticed you while you were away.') +
      (canSee ? P(who) : P('Like them back from Discover for an instant match — or upgrade to Gold to see exactly who.')) +
      BUTTON(canSee ? 'See who liked you' : 'See your likes', '/matches#liked-you'),
  }
}

/**
 * UNREAD_MESSAGES (key = SAST date): unread messages older than 6h, member not
 * seen in 12h, at most once per 24h, and only when something arrived since the
 * last reminder (so a stale unread inbox isn't nagged daily). Count only.
 */
async function unreadMessages(now: Date, budget: Budget): Promise<Counts> {
  const c = zero()
  if (budget.done) return c
  const olderThan = new Date(now.getTime() - 6 * HOUR)
  const notBefore = new Date(now.getTime() - 30 * DAY)
  const rows = await db.$queryRaw<{ userId: string; n: number; latest: Date; oldest: Date }[]>`
    SELECT cp."userId", COUNT(*)::int AS n, MAX(m."createdAt") AS latest, MIN(m."createdAt") AS oldest
      FROM "Message" m
      JOIN "ConversationParticipant" cp ON cp."conversationId" = m."conversationId" AND cp."userId" <> m."senderId"
      JOIN "User" s ON s.id = m."senderId" AND s."isActive" = true
     WHERE m."isRead" = false AND m."createdAt" <= ${olderThan} AND m."createdAt" >= ${notBefore}
       AND NOT EXISTS (SELECT 1 FROM "Block" b WHERE (b."blockerId" = cp."userId" AND b."blockedId" = m."senderId")
                                               OR (b."blockerId" = m."senderId" AND b."blockedId" = cp."userId"))
     GROUP BY cp."userId"`
  if (rows.length === 0) return c
  const byUser = new Map(rows.map((r) => [r.userId, r]))
  const { date } = sast(now)
  const users = await db.user.findMany({
    where: {
      AND: [
        reachable(now),
        {
          id: { in: [...byUser.keys()] },
          profile: { is: { lastSeen: { lt: new Date(now.getTime() - 12 * HOUR) } } },
          emailLogs: { none: { kind: 'UNREAD_MESSAGES', OR: [{ createdAt: { gte: new Date(now.getTime() - DAY) } }, { key: date }] } },
        },
      ],
    },
    select: { ...memberSelect, emailLogs: { where: { kind: 'UNREAD_MESSAGES' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
  })
  const due = users
    .filter((u) => {
      const last = u.emailLogs[0]?.createdAt
      return !last || byUser.get(u.id)!.latest > last
    })
    .sort((a, b) => byUser.get(a.id)!.oldest.getTime() - byUser.get(b.id)!.oldest.getTime())
  for (const u of due) {
    if (budget.done) break
    const n = byUser.get(u.id)!.n
    await tally(c, budget, sendOnce(u.id, 'UNREAD_MESSAGES', date, () => unreadEmail(u, n), now))
  }
  return c
}

function unreadEmail(u: Member, n: number): BuiltEmail {
  const plural = n === 1 ? 'unread message' : 'unread messages'
  return {
    to: u.email,
    subject: `You have ${n} ${plural}`,
    title: 'Messages',
    bodyHtml:
      H(`${n} ${plural} waiting`) +
      hi(u) +
      P('Someone’s waiting to hear from you. For your privacy we never put message contents in email.') +
      BUTTON('Open messages', '/messages'),
  }
}

/** WIN_BACK (key = YYYY-MM): once per 30 days, for members last seen 14–60 days ago. */
async function winBack(now: Date, budget: Budget): Promise<Counts> {
  const c = zero()
  if (budget.done) return c
  const { month } = sast(now)
  const users = await db.user.findMany({
    where: {
      AND: [
        reachable(now),
        {
          profile: { is: { lastSeen: { gte: new Date(now.getTime() - 60 * DAY), lte: new Date(now.getTime() - 14 * DAY) } } },
          emailLogs: { none: { kind: 'WIN_BACK', OR: [{ createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }, { key: month }] } },
        },
      ],
    },
    orderBy: { profile: { lastSeen: 'asc' } },
    take: budget.left,
    select: memberSelect,
  })
  for (const u of users) {
    if (budget.done) break
    await tally(c, budget, sendOnce(u.id, 'WIN_BACK', month, () => winBackEmail(u), now))
  }
  return c
}

async function winBackEmail(u: Member): Promise<BuiltEmail> {
  const city = u.profile?.city?.trim()
  const since = u.profile?.lastSeen ?? u.createdAt
  let nearby = 0
  if (city) {
    nearby = await db.user.count({
      where: {
        id: { not: u.id },
        isActive: true,
        createdAt: { gt: since },
        profile: { is: { city: { equals: city, mode: 'insensitive' } } },
      },
    })
  }
  const line =
    nearby >= 3
      ? `<strong style="color:#fff;">${nearby} new members</strong> have joined in ${escapeHtml(city!)} since your last visit.`
      : 'New members have joined since your last visit, and there’s always something happening in the community.'
  return {
    to: u.email,
    subject: nearby >= 3 ? `${nearby} new members near you on Unbound` : 'It’s been a while — here’s what’s new',
    title: 'We miss you',
    bodyHtml: H('It’s been a while') + hi(u) + P(line) + P('Take a look — you might like who you find.') + BUTTON('Explore Discover', '/discover'),
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────

export interface LifecycleRunResult {
  ok: true
  skipped?: 'quiet-hours'
  limit: number
  sent: number
  kinds: Record<LifecycleKind, Counts>
}

export function batchLimit(): number {
  const n = parseInt(process.env.LIFECYCLE_BATCH_LIMIT ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 200
}

/** Run every lifecycle email once. Safe to call repeatedly. */
export async function runLifecycleEmails(now = new Date(), limit = batchLimit()): Promise<LifecycleRunResult> {
  const kinds: Record<LifecycleKind, Counts> = {
    WELCOME_1: zero(),
    PROFILE_NUDGE: zero(),
    LIKES_DIGEST: zero(),
    UNREAD_MESSAGES: zero(),
    WIN_BACK: zero(),
  }
  if (!inSendWindow(now)) return { ok: true, skipped: 'quiet-hours', limit, sent: 0, kinds }
  unsubscribeSecret() // fail loudly before claiming anything

  const budget = new Budget(limit)
  // Most time-sensitive first; the budget carries over between kinds.
  kinds.WELCOME_1 = await welcome(now, budget)
  kinds.UNREAD_MESSAGES = await unreadMessages(now, budget)
  kinds.LIKES_DIGEST = await likesDigest(now, budget)
  kinds.PROFILE_NUDGE = await profileNudge(now, budget)
  kinds.WIN_BACK = await winBack(now, budget)
  return { ok: true, limit, sent: limit - budget.left, kinds }
}
