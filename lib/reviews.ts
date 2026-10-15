/**
 * Member reviews (Airbnb-style), free for every plan.
 *
 * Flow
 *  1. Requesting. A member (the requester — the person to be reviewed) asks
 *     another member (the reviewer) for a review. Allowed only when the two
 *     have had a real two-way conversation: a Conversation containing both
 *     sides where each side (a person, or either partner of a linked couple)
 *     has sent at least one message. Not blocked either way, both accounts
 *     active, no open request for the pair, the reviewer hasn't already
 *     reviewed the requester, max REQUESTS_PER_DAY requests per 24 hours.
 *     Requests expire after REQUEST_TTL_DAYS. The requester can cancel.
 *     The reviewer can write the review or decline. A decline is never shown
 *     to the requester: their request just reads "waiting" until it expires
 *     (and blocks a new request for the pair until then).
 *  2. Reviewing. Only via a PENDING, unexpired request addressed to the
 *     reviewer. One review per reviewer → reviewee (@@unique). Five 1–5
 *     ratings + a 20–500 character comment (see lib/review-text.ts).
 *  3. Double-blind publishing. A new review is hidden (publishedAt null).
 *     It is published when the reviewee has also reviewed the reviewer (both
 *     publish together), or BLIND_DAYS after it was written. The time-based
 *     path runs lazily (publishDueReviews() on review/profile reads) and from
 *     the cron route /api/cron/reviews. Reviewers can edit until published.
 *  4. Responses & moderation. The reviewee may post one public response per
 *     published review. Anyone can report a review; admins hide/unhide.
 *     Hidden reviews don't count and aren't shown.
 *
 * Scores
 *  - Per-criterion averages and the overall average use published,
 *    non-hidden reviews only.
 *  - Profile.ratingAvg = the mean of the five criterion averages. Because
 *    every review rates all five criteria, this is exactly the same number as
 *    the mean of each review's own average. Stored rounded to 2 decimals.
 *  - Profile.ratingCount = number of those reviews.
 *  - recomputeRating() is the single place that writes them; it runs whenever
 *    a review is published, hidden, unhidden or deleted (and the cron re-syncs
 *    everyone with reviews as a safety net, e.g. after account deletions).
 *
 * Ranking (trust score — ranking only, never displayed)
 *  - Bayesian average: score = (C·m + n·avg) / (C + n), prior m = 4.0,
 *    C = 3, n = ratingCount. No reviews → score = m (neutral, no penalty).
 *  - Mild down-rank: ratingAvg < 3.0 with ≥ 3 reviews → score − 0.5.
 *  - Search "Best match" and Today's picks: rank by
 *    compatibility + 12·(score − 4)  (a 4.8 adds ~10 points; a poor record
 *    with the down-rank can cost ~20 of 100).
 *  - Default ordering (nearest / discover deck): distance is compared on
 *    effectiveKm = km − 1.5·(score − 4), i.e. a strong record counts as up to
 *    ~1.5 km closer, a weak one ~2–3 km further. Only the ORDER changes —
 *    radius filtering and the displayed distance use the real km.
 *  - Default ordering without a location (recently active): members active
 *    in the same day-bucket are ordered by score before exact recency.
 *  - Explicit "Recently active" and "Newest" sorts are left literal.
 */
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { reviewTextProblem, sanitizeText } from '@/lib/review-text'
import { getCoupleMemberNames, coupleDisplayName, getPartnerMap, isBlockedBetween, sideOf } from '@/lib/couples'

// ── Constants ───────────────────────────────────────────────────────────────

export {
  CRITERIA, REQUEST_TTL_DAYS, BLIND_DAYS, COMMENT_MIN, COMMENT_MAX, RESPONSE_MAX, REQUESTS_PER_DAY,
  PROMPT_MIN_TOTAL, PROMPT_MIN_EACH,
} from '@/lib/review-criteria'
export type { CriterionKey, Ratings } from '@/lib/review-criteria'
import {
  CRITERIA, REQUEST_TTL_DAYS, BLIND_DAYS, COMMENT_MIN, COMMENT_MAX, RESPONSE_MAX, REQUESTS_PER_DAY,
  PROMPT_MIN_TOTAL, PROMPT_MIN_EACH, type CriterionKey, type Ratings,
} from '@/lib/review-criteria'

const DAY = 24 * 60 * 60 * 1000

// ── Trust score (ranking only) ──────────────────────────────────────────────

export const PRIOR_MEAN = 4.0
export const PRIOR_WEIGHT = 3

/** Bayesian average used for ranking. See the header comment. */
export function trustScore(avg: number | null | undefined, count: number | null | undefined): number {
  const n = Math.max(0, count ?? 0)
  if (!n || avg == null || !Number.isFinite(avg)) return PRIOR_MEAN
  let s = (PRIOR_WEIGHT * PRIOR_MEAN + n * avg) / (PRIOR_WEIGHT + n)
  if (avg < 3 && n >= 3) s -= 0.5
  return s
}

/** "Best match" / picks: compatibility (0–100) adjusted by trust. */
export function trustAdjustedCompat(compatibility: number, avg: number | null | undefined, count: number | null | undefined): number {
  return compatibility + 12 * (trustScore(avg, count) - PRIOR_MEAN)
}

/** Default "nearest" ordering: distance nudged by trust (order only). */
export function trustAdjustedKm(km: number, avg: number | null | undefined, count: number | null | undefined): number {
  return km - 1.5 * (trustScore(avg, count) - PRIOR_MEAN)
}

// ── Validation ──────────────────────────────────────────────────────────────

export function parseRatings(body: Record<string, unknown> | null | undefined): Ratings | null {
  if (!body) return null
  const src = (body.ratings && typeof body.ratings === 'object' ? body.ratings : body) as Record<string, unknown>
  const out = {} as Ratings
  for (const c of CRITERIA) {
    const v = typeof src[c.key] === 'string' ? Number(src[c.key]) : src[c.key]
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return null
    out[c.key] = v
  }
  return out
}

/** Clean + validate a review comment; returns [clean, error message or null]. */
export function checkComment(raw: unknown): [string, string | null] {
  const comment = sanitizeText(raw, COMMENT_MAX)
  if (comment.length < COMMENT_MIN) return [comment, `Please write at least ${COMMENT_MIN} characters about your experience.`]
  if (comment.length > COMMENT_MAX) return [comment, `Please keep it to ${COMMENT_MAX} characters or fewer.`]
  return [comment, reviewTextProblem(comment)]
}

/** Clean + validate a reviewee response (may be empty = remove). */
export function checkResponse(raw: unknown): [string, string | null] {
  const text = sanitizeText(raw, RESPONSE_MAX)
  if (text.length > RESPONSE_MAX) return [text, `Please keep it to ${RESPONSE_MAX} characters or fewer.`]
  return [text, text ? reviewTextProblem(text) : null]
}

export function reviewMean(r: Ratings): number {
  return CRITERIA.reduce((s, c) => s + r[c.key], 0) / CRITERIA.length
}

// ── People helpers ──────────────────────────────────────────────────────────

export const reviewPersonSelect = {
  id: true,
  username: true,
  isActive: true,
  profile: {
    select: {
      displayName: true, profilePhoto: true, city: true, dateOfBirth: true,
      isCouple: true, coupleMembers: true,
      partner: { select: { displayName: true, user: { select: { isActive: true } } } },
    },
  },
} satisfies Prisma.UserSelect

type ReviewPersonRow = Prisma.UserGetPayload<{ select: typeof reviewPersonSelect }>

export interface ReviewPerson {
  id: string
  username: string
  /** First name ("Thandi"), or both names for couples ("Thandi & Sipho"). */
  name: string
  photo: string | null
  city: string | null
  age: number | null
  isCouple: boolean
}

function ageOf(d: Date | null | undefined): number | null {
  if (!d) return null
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a >= 18 && a < 120 ? a : null
}

export function firstName(u: { username: string; profile?: { displayName?: string | null; isCouple?: boolean | null; coupleMembers?: unknown } | null }): string {
  const p = u.profile
  if (p?.isCouple) {
    const names = getCoupleMemberNames(p.coupleMembers)
    if (names.length >= 2) return coupleDisplayName(names)
    if (p.displayName) return p.displayName.trim().slice(0, 40)
  }
  const dn = p?.displayName?.trim()
  if (dn) return dn.split(/\s+/)[0].slice(0, 30)
  return u.username
}

export function toReviewPerson(u: ReviewPersonRow): ReviewPerson {
  const p = u.profile
  let name = firstName(u)
  if (p?.isCouple && p.partner?.displayName && p.partner.user?.isActive !== false && p.displayName && !name.includes('&')) {
    name = coupleDisplayName([p.displayName.split(/\s+/)[0], p.partner.displayName.split(/\s+/)[0]])
  }
  return {
    id: u.id,
    username: u.username,
    name,
    photo: p?.profilePhoto ?? null,
    city: p?.city ?? null,
    age: p?.isCouple ? null : ageOf(p?.dateOfBirth),
    isCouple: !!p?.isCouple,
  }
}

// ── Maintenance: expire requests, publish due reviews ───────────────────────

/** Mark overdue PENDING requests EXPIRED. Cheap (indexed by status). */
export async function expireRequests(now = new Date()): Promise<number> {
  const r = await db.reviewRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  })
  return r.count
}

/**
 * Publish reviews whose blind period is over. Each review is claimed with a
 * conditional update so overlapping runs never double-notify. Returns the
 * number published.
 */
export async function publishDueReviews(now = new Date(), max = 200): Promise<number> {
  const due = await db.review.findMany({
    where: { publishedAt: null, createdAt: { lt: new Date(now.getTime() - BLIND_DAYS * DAY) } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: max,
  })
  if (due.length === 0) return 0
  let published = 0
  const touched = new Set<string>()
  for (const { id } of due) {
    const claim = await db.review.updateMany({ where: { id, publishedAt: null }, data: { publishedAt: now } })
    if (claim.count !== 1) continue
    published++
    const r = await db.review.findUnique({ where: { id }, select: { revieweeId: true, reviewerId: true } })
    if (!r) continue
    touched.add(r.revieweeId)
    await notifyPublished([id])
  }
  for (const u of touched) await recomputeRating(u)
  return published
}

/** Lazy maintenance run on review / profile reads. Never throws. */
export async function reviewMaintenance(): Promise<void> {
  try {
    const now = new Date()
    await expireRequests(now)
    await publishDueReviews(now, 50)
  } catch (e) {
    console.error('review maintenance failed:', e instanceof Error ? e.message : e)
  }
}

// ── Scores ──────────────────────────────────────────────────────────────────

export const visibleReviewWhere = (revieweeId: string): Prisma.ReviewWhereInput => ({
  revieweeId, publishedAt: { not: null }, isHidden: false,
})

export interface ReviewSummary {
  count: number
  /** Overall average (mean of the five criterion averages), 1 decimal; null with no reviews. */
  avg: number | null
  criteria: Record<CriterionKey, number | null>
  /** Fewer than 3 reviews. */
  isNew: boolean
}

export async function summaryFor(userId: string): Promise<ReviewSummary> {
  const agg = await db.review.aggregate({
    where: visibleReviewWhere(userId),
    _count: { _all: true },
    _avg: { respectful: true, communication: true, authenticity: true, reliability: true, overall: true },
  })
  const count = agg._count._all
  const criteria = {} as Record<CriterionKey, number | null>
  let sum = 0
  for (const c of CRITERIA) {
    const v = agg._avg[c.key]
    criteria[c.key] = v == null ? null : Math.round(v * 10) / 10
    sum += v ?? 0
  }
  const avg = count ? Math.round((sum / CRITERIA.length) * 100) / 100 : null
  return { count, avg: avg == null ? null : Math.round(avg * 10) / 10, criteria, isNew: count < 3 }
}

/** The one place Profile.ratingAvg / ratingCount are written. */
export async function recomputeRating(userId: string): Promise<{ avg: number | null; count: number }> {
  const agg = await db.review.aggregate({
    where: visibleReviewWhere(userId),
    _count: { _all: true },
    _avg: { respectful: true, communication: true, authenticity: true, reliability: true, overall: true },
  })
  const count = agg._count._all
  const avg = count
    ? Math.round((CRITERIA.reduce((s, c) => s + (agg._avg[c.key] ?? 0), 0) / CRITERIA.length) * 100) / 100
    : null
  await db.profile.updateMany({ where: { userId }, data: { ratingAvg: avg, ratingCount: count } })
  return { avg, count }
}

// ── Notifications ───────────────────────────────────────────────────────────

async function notify(userId: string, type: string, title: string, body: string, url: string, extra: Record<string, unknown> = {}) {
  await db.notification.create({ data: { userId, type, title, body, data: { url, ...extra } as Prisma.InputJsonValue } }).catch(() => {})
  sendPushToUser(userId, { title, body, url, tag: `${type.toLowerCase()}-${String(extra.reviewId ?? extra.requestId ?? '')}` }).catch(() => {})
}

async function nameOf(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: reviewPersonSelect })
  return u ? toReviewPerson(u).name : 'A member'
}

/** Tell each reviewee their review is now public. */
export async function notifyPublished(reviewIds: string[]) {
  const rows = await db.review.findMany({ where: { id: { in: reviewIds } }, select: { id: true, reviewerId: true, revieweeId: true } })
  for (const r of rows) {
    const who = await nameOf(r.reviewerId)
    await notify(r.revieweeId, 'REVIEW_PUBLISHED', `${who}’s review of you is live`, 'See what they said — you can add a public response.', '/reviews#received', { reviewId: r.id })
  }
}

export async function notifyRequest(requestId: string, requesterId: string, reviewerId: string) {
  const who = await nameOf(requesterId)
  await notify(
    reviewerId, 'REVIEW_REQUEST', `${who} asked you for a review`,
    `How was meeting ${who}? Reviews stay hidden until you’ve both written one, or for ${BLIND_DAYS} days.`,
    `/reviews/write/${requestId}`, { requestId },
  )
}

export async function notifyReceived(reviewId: string, reviewerId: string, revieweeId: string) {
  const who = await nameOf(reviewerId)
  await notify(
    revieweeId, 'REVIEW_RECEIVED', `${who} left you a review`,
    `It’ll appear when you review them back or in ${BLIND_DAYS} days.`, '/reviews#awaiting', { reviewId },
  )
}

// ── Publishing on write ─────────────────────────────────────────────────────

/**
 * After a review is created: if the reviewee has reviewed the reviewer too,
 * publish both (the other one may already be public after its blind period).
 * Returns true when the new review was published.
 */
export async function publishIfMutual(reviewId: string): Promise<boolean> {
  const r = await db.review.findUnique({ where: { id: reviewId }, select: { id: true, reviewerId: true, revieweeId: true, publishedAt: true } })
  if (!r || r.publishedAt) return !!r?.publishedAt
  const other = await db.review.findUnique({
    where: { reviewerId_revieweeId: { reviewerId: r.revieweeId, revieweeId: r.reviewerId } },
    select: { id: true, publishedAt: true },
  })
  if (!other) return false
  const now = new Date()
  const claimed: string[] = []
  for (const id of [r.id, other.id]) {
    const c = await db.review.updateMany({ where: { id, publishedAt: null }, data: { publishedAt: now } })
    if (c.count === 1) claimed.push(id)
  }
  await recomputeRating(r.revieweeId)
  await recomputeRating(r.reviewerId)
  if (claimed.length) await notifyPublished(claimed)
  return true
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export type IneligibleReason =
  | 'self' | 'partner' | 'not_found' | 'inactive' | 'blocked' | 'no_conversation'
  | 'pending' | 'already_reviewed'

export const INELIGIBLE_MESSAGE: Record<IneligibleReason, string> = {
  self: 'You can’t review yourself.',
  partner: 'Partners in a linked couple can’t review each other.',
  not_found: 'Member not found.',
  inactive: 'This member isn’t active right now.',
  blocked: 'You can’t request a review from this member.',
  no_conversation: 'You can ask for a review once you’ve both chatted on Unbound.',
  pending: 'You’ve already asked — waiting for their reply.',
  already_reviewed: 'They’ve already reviewed you.',
}

/** userIds on the other side of a two-way conversation with `userId`'s side. */
export async function twoWayPartners(userId: string, opts: { conversationId?: string } = {}): Promise<{
  partners: Map<string, { conversationId: string; mine: number; theirs: number }>
}> {
  const partnerMap0 = await getPartnerMap([userId])
  const mySide = sideOf(userId, partnerMap0)
  const convs = await db.conversation.findMany({
    where: {
      participants: { some: { userId: { in: mySide } } },
      ...(opts.conversationId ? { id: opts.conversationId } : {}),
      lastMessageAt: { not: null },
    },
    select: { id: true, participants: { select: { userId: true } } },
    orderBy: { lastMessageAt: 'desc' },
    take: 300,
  })
  const partners = new Map<string, { conversationId: string; mine: number; theirs: number }>()
  if (convs.length === 0) return { partners }
  const everyone = new Set<string>()
  for (const c of convs) for (const p of c.participants) everyone.add(p.userId)
  const partnerMap = await getPartnerMap(Array.from(everyone))
  const counts = await db.message.groupBy({
    by: ['conversationId', 'senderId'],
    where: { conversationId: { in: convs.map((c) => c.id) } },
    _count: { _all: true },
  })
  const byConv = new Map<string, Map<string, number>>()
  for (const row of counts) {
    if (!byConv.has(row.conversationId)) byConv.set(row.conversationId, new Map())
    byConv.get(row.conversationId)!.set(row.senderId, row._count._all)
  }
  for (const c of convs) {
    const sent = byConv.get(c.id)
    if (!sent) continue
    const mine = mySide.reduce((n, u) => n + (sent.get(u) ?? 0), 0)
    if (mine < 1) continue
    for (const p of c.participants) {
      if (mySide.includes(p.userId)) continue
      const theirSide = sideOf(p.userId, partnerMap)
      const theirs = theirSide.reduce((n, u) => n + (sent.get(u) ?? 0), 0)
      if (theirs < 1) continue
      const prev = partners.get(p.userId)
      if (!prev || prev.mine + prev.theirs < mine + theirs) partners.set(p.userId, { conversationId: c.id, mine, theirs })
    }
  }
  return { partners }
}

/** An open request = PENDING, or DECLINED but not yet expired (declines are never revealed). */
export function openRequestWhere(requesterId: string, reviewerId: string, now = new Date()): Prisma.ReviewRequestWhereInput {
  return { requesterId, reviewerId, status: { in: ['PENDING', 'DECLINED'] }, expiresAt: { gt: now } }
}

export async function checkCanRequest(requesterId: string, reviewerId: string): Promise<{ ok: true } | { ok: false; reason: IneligibleReason }> {
  if (requesterId === reviewerId) return { ok: false, reason: 'self' }
  const users = await db.user.findMany({ where: { id: { in: [requesterId, reviewerId] } }, select: { id: true, isActive: true } })
  if (users.length < 2) return { ok: false, reason: 'not_found' }
  if (users.some((u) => !u.isActive)) return { ok: false, reason: 'inactive' }
  const partnerMap = await getPartnerMap([requesterId, reviewerId])
  const a = sideOf(requesterId, partnerMap)
  const b = sideOf(reviewerId, partnerMap)
  if (a.includes(reviewerId)) return { ok: false, reason: 'partner' }
  if (await isBlockedBetween(a, b)) return { ok: false, reason: 'blocked' }
  const existingReview = await db.review.findUnique({
    where: { reviewerId_revieweeId: { reviewerId, revieweeId: requesterId } }, select: { id: true },
  })
  if (existingReview) return { ok: false, reason: 'already_reviewed' }
  const open = await db.reviewRequest.findFirst({ where: openRequestWhere(requesterId, reviewerId), select: { id: true } })
  if (open) return { ok: false, reason: 'pending' }
  const { partners } = await twoWayPartners(requesterId)
  if (!partners.has(reviewerId)) return { ok: false, reason: 'no_conversation' }
  return { ok: true }
}

export type CreateRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: IneligibleReason | 'rate_limited'; message: string }

/** Create a request (all checks + notification). */
export async function createReviewRequest(requesterId: string, reviewerId: string): Promise<CreateRequestResult> {
  const since = new Date(Date.now() - DAY)
  const recent = await db.reviewRequest.count({ where: { requesterId, createdAt: { gt: since } } })
  if (recent >= REQUESTS_PER_DAY) {
    return { ok: false, reason: 'rate_limited', message: `You can send up to ${REQUESTS_PER_DAY} review requests a day. Try again tomorrow.` }
  }
  await expireRequests()
  const check = await checkCanRequest(requesterId, reviewerId)
  if (!check.ok) return { ok: false, reason: check.reason, message: INELIGIBLE_MESSAGE[check.reason] }
  const req = await db.reviewRequest.create({
    data: { requesterId, reviewerId, expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * DAY) },
    select: { id: true },
  })
  await notifyRequest(req.id, requesterId, reviewerId)
  return { ok: true, requestId: req.id }
}

// ── Shapes for the client ───────────────────────────────────────────────────

export const reviewCardSelect = {
  id: true, reviewerId: true, revieweeId: true,
  respectful: true, communication: true, authenticity: true, reliability: true, overall: true,
  comment: true, isExplicit: true, response: true, responseAt: true, publishedAt: true, createdAt: true, updatedAt: true,
  isHidden: true, hiddenReason: true,
  reviewer: { select: reviewPersonSelect },
} satisfies Prisma.ReviewSelect

export type ReviewCardRow = Prisma.ReviewGetPayload<{ select: typeof reviewCardSelect }>

export interface ReviewCard {
  id: string
  reviewer: ReviewPerson
  ratings: Ratings
  rating: number
  comment: string
  isExplicit: boolean
  /** "October 2026" */
  metIn: string
  response: string | null
  responseAt: string | null
  publishedAt: string | null
  hidden: boolean
}

export function monthYear(d: Date): string {
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })
}

export function toReviewCard(r: ReviewCardRow): ReviewCard {
  const ratings = {} as Ratings
  for (const c of CRITERIA) ratings[c.key] = r[c.key]
  return {
    id: r.id,
    reviewer: toReviewPerson(r.reviewer),
    ratings,
    rating: Math.round(reviewMean(ratings) * 10) / 10,
    comment: r.isHidden ? '' : r.comment,
    isExplicit: r.isExplicit,
    metIn: monthYear(r.createdAt),
    response: r.isHidden ? null : r.response,
    responseAt: r.responseAt?.toISOString() ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    hidden: r.isHidden,
  }
}

/** Requests as the requester sees them: a decline is shown as "waiting" until expiry. */
export function requesterStatus(r: { status: string; expiresAt: Date }, now = new Date()): 'PENDING' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED' {
  if (r.status === 'COMPLETED') return 'COMPLETED'
  if (r.status === 'CANCELLED') return 'CANCELLED'
  if (r.expiresAt <= now || r.status === 'EXPIRED') return 'EXPIRED'
  return 'PENDING'
}

/** Days until a hidden review publishes on its own. */
export function publishesOn(createdAt: Date): Date {
  return new Date(createdAt.getTime() + BLIND_DAYS * DAY)
}
