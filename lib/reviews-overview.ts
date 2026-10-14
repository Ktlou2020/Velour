/**
 * Read models for the reviews UI: the member's own overview (/reviews, own
 * profile card) and the list of people they can ask for a review.
 */
import { db } from '@/lib/db'
import { getPartnerMap, isBlockedBetween, sideOf } from '@/lib/couples'
import {
  INELIGIBLE_MESSAGE, PROMPT_MIN_EACH, PROMPT_MIN_TOTAL, openRequestWhere, publishesOn, requesterStatus,
  reviewMaintenance, reviewPersonSelect, summaryFor, toReviewPerson, twoWayPartners,
  type IneligibleReason, type ReviewPerson, type ReviewSummary,
} from '@/lib/reviews'

export interface EligiblePerson {
  person: ReviewPerson
  conversationId: string
  messages: { mine: number; theirs: number }
  canRequest: boolean
  reason?: IneligibleReason
  reasonText?: string
  /** Enough back-and-forth for the gentle "Met up?" chat prompt. */
  prompt: boolean
}

/** People `userId` has had a two-way conversation with, with request eligibility. */
export async function eligiblePeople(userId: string, opts: { conversationId?: string } = {}): Promise<EligiblePerson[]> {
  const { partners } = await twoWayPartners(userId, opts)
  const ids = Array.from(partners.keys())
  if (ids.length === 0) return []
  const now = new Date()
  const [users, reviewsOfMe, open] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: reviewPersonSelect }),
    db.review.findMany({ where: { reviewerId: { in: ids }, revieweeId: userId }, select: { reviewerId: true } }),
    db.reviewRequest.findMany({
      where: { ...openRequestWhere(userId, '', now), reviewerId: { in: ids } },
      select: { reviewerId: true },
    }),
  ])
  const reviewed = new Set(reviewsOfMe.map((r) => r.reviewerId))
  const pending = new Set(open.map((r) => r.reviewerId))
  const partnerMap = await getPartnerMap([userId, ...ids])
  const mySide = sideOf(userId, partnerMap)
  const out: EligiblePerson[] = []
  for (const u of users) {
    const info = partners.get(u.id)!
    let reason: IneligibleReason | undefined
    if (!u.isActive) reason = 'inactive'
    else if (await isBlockedBetween(mySide, sideOf(u.id, partnerMap))) reason = 'blocked'
    else if (reviewed.has(u.id)) reason = 'already_reviewed'
    else if (pending.has(u.id)) reason = 'pending'
    if (reason === 'blocked' || reason === 'inactive') continue // never list these
    out.push({
      person: toReviewPerson(u),
      conversationId: info.conversationId,
      messages: { mine: info.mine, theirs: info.theirs },
      canRequest: !reason,
      ...(reason ? { reason, reasonText: INELIGIBLE_MESSAGE[reason] } : {}),
      prompt: !reason && info.mine + info.theirs >= PROMPT_MIN_TOTAL && info.mine >= PROMPT_MIN_EACH && info.theirs >= PROMPT_MIN_EACH,
    })
  }
  return out.sort((a, b) => Number(b.canRequest) - Number(a.canRequest) || a.person.name.localeCompare(b.person.name))
}

export interface ReviewsOverview {
  summary: ReviewSummary
  /** Requests others sent me that I can answer. */
  toWrite: { id: string; requester: ReviewPerson; createdAt: string; expiresAt: string }[]
  /** My reviews that aren't public yet (editable). */
  drafts: { id: string; requestId: string | null; reviewee: ReviewPerson; createdAt: string; publishesOn: string }[]
  /** Requests I sent (declines look like "waiting" until they expire). */
  sent: { id: string; reviewer: ReviewPerson; status: 'PENDING' | 'EXPIRED' | 'COMPLETED'; createdAt: string; expiresAt: string }[]
  /** Reviews about me waiting for publication. */
  awaiting: { id: string; reviewer: ReviewPerson; publishesOn: string; writeRequestId: string | null }[]
  /** Reviews I've written that are public. */
  written: { id: string; reviewee: ReviewPerson; publishedAt: string; rating: number }[]
}

export async function reviewsOverview(userId: string): Promise<ReviewsOverview> {
  await reviewMaintenance()
  const now = new Date()
  const [summary, toWrite, drafts, sent, awaiting, written] = await Promise.all([
    summaryFor(userId),
    db.reviewRequest.findMany({
      where: { reviewerId: userId, status: 'PENDING', expiresAt: { gt: now }, requester: { isActive: true } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, createdAt: true, expiresAt: true, requester: { select: reviewPersonSelect } },
    }),
    db.review.findMany({
      where: { reviewerId: userId, publishedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, requestId: true, createdAt: true, reviewee: { select: reviewPersonSelect } },
    }),
    db.reviewRequest.findMany({
      where: { requesterId: userId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, status: true, createdAt: true, expiresAt: true, reviewer: { select: reviewPersonSelect } },
    }),
    db.review.findMany({
      where: { revieweeId: userId, publishedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, createdAt: true, reviewerId: true, reviewer: { select: reviewPersonSelect } },
    }),
    db.review.findMany({
      where: { reviewerId: userId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: {
        id: true, publishedAt: true, respectful: true, communication: true, authenticity: true, reliability: true, overall: true,
        reviewee: { select: reviewPersonSelect },
      },
    }),
  ])
  // For "X left you a review": is there a request from X I can answer?
  const writeReq = new Map(toWrite.map((r) => [r.requester.id, r.id]))
  return {
    summary,
    toWrite: toWrite.map((r) => ({ id: r.id, requester: toReviewPerson(r.requester), createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() })),
    drafts: drafts.map((d) => ({ id: d.id, requestId: d.requestId, reviewee: toReviewPerson(d.reviewee), createdAt: d.createdAt.toISOString(), publishesOn: publishesOn(d.createdAt).toISOString() })),
    sent: sent.map((s) => {
      const st = requesterStatus(s, now)
      return { id: s.id, reviewer: toReviewPerson(s.reviewer), status: st === 'CANCELLED' ? 'EXPIRED' : st, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString() }
    }),
    awaiting: awaiting.map((a) => ({ id: a.id, reviewer: toReviewPerson(a.reviewer), publishesOn: publishesOn(a.createdAt).toISOString(), writeRequestId: writeReq.get(a.reviewerId) ?? null })),
    written: written.map((w) => ({
      id: w.id, reviewee: toReviewPerson(w.reviewee), publishedAt: w.publishedAt!.toISOString(),
      rating: Math.round(((w.respectful + w.communication + w.authenticity + w.reliability + w.overall) / 5) * 10) / 10,
    })),
  }
}
