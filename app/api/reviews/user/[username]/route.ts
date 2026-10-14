import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isBlockedBetween } from '@/lib/couples'
import {
  INELIGIBLE_MESSAGE, checkCanRequest, reviewCardSelect, reviewMaintenance, summaryFor, toReviewCard,
} from '@/lib/reviews'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews/user/[username]?page=1&limit=6
 * Published, non-hidden reviews of a member + aggregates + what the viewer can do.
 * The member themselves also sees their hidden reviews (flagged, without text).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { username } = await params
    if (!username || username.length > 64) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    const target = await db.user.findUnique({ where: { username }, select: { id: true, isActive: true } })
    const isOwner = target?.id === me
    if (!target || (!isOwner && !target.isActive)) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!isOwner) {
      // Blocked either way → as if the member doesn't exist (same as the profile page)
      if (await isBlockedBetween([me], [target.id])) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    await reviewMaintenance()
    const sp = new URL(req.url).searchParams
    const page = Math.min(500, Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1))
    const limit = Math.min(20, Math.max(1, parseInt(sp.get('limit') ?? '6', 10) || 6))
    const where = { revieweeId: target.id, publishedAt: { not: null }, ...(isOwner ? {} : { isHidden: false }) }

    const [summary, total, rows] = await Promise.all([
      summaryFor(target.id),
      db.review.count({ where }),
      db.review.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit, select: reviewCardSelect }),
    ])

    let viewer: Record<string, unknown> = { isOwner }
    if (!isOwner) {
      const now = new Date()
      const [check, fromThem, mine] = await Promise.all([
        checkCanRequest(me, target.id),
        db.reviewRequest.findFirst({ where: { requesterId: target.id, reviewerId: me, status: 'PENDING', expiresAt: { gt: now } }, select: { id: true } }),
        db.review.findUnique({ where: { reviewerId_revieweeId: { reviewerId: me, revieweeId: target.id } }, select: { id: true, publishedAt: true, requestId: true } }),
      ])
      viewer = {
        isOwner,
        canRequest: check.ok,
        ...(check.ok ? {} : { reason: check.reason, reasonText: INELIGIBLE_MESSAGE[check.reason] }),
        pendingRequestFromThem: fromThem ? { id: fromThem.id } : null,
        myReview: mine ? { id: mine.id, published: !!mine.publishedAt, requestId: mine.requestId } : null,
      }
    }

    return NextResponse.json({
      summary,
      reviews: rows.map(toReviewCard),
      page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
      viewer,
    })
  } catch (error) {
    console.error('GET /api/reviews/user/[username] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
