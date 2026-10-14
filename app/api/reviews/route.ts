import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { isValidId } from '@/lib/security'
import { getPartnerMap, isBlockedBetween, sideOf } from '@/lib/couples'
import {
  checkComment, createReviewRequest, notifyReceived, parseRatings, publishIfMutual,
} from '@/lib/reviews'
import { reviewsOverview } from '@/lib/reviews-overview'

export const dynamic = 'force-dynamic'

/** GET /api/reviews — the signed-in member's reviews overview. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await reviewsOverview(session.user.id))
  } catch (error) {
    console.error('GET /api/reviews error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/reviews — write a review.
 * Body: { requestId, ratings: { respectful, communication, authenticity, reliability, overall }, comment, isExplicit?, askBack? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`review:write:${me}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body || !isValidId(body.requestId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const ratings = parseRatings(body)
    if (!ratings) return NextResponse.json({ error: 'Please rate all five areas from 1 to 5 stars.' }, { status: 400 })
    const [comment, problem] = checkComment(body.comment)
    if (problem) return NextResponse.json({ error: problem, field: 'comment' }, { status: 400 })
    const isExplicit = body.isExplicit === true

    const request = await db.reviewRequest.findUnique({
      where: { id: body.requestId },
      select: { id: true, requesterId: true, reviewerId: true, status: true, expiresAt: true, requester: { select: { isActive: true } } },
    })
    if (!request || request.reviewerId !== me) return NextResponse.json({ error: 'Review request not found' }, { status: 404 })
    if (request.status !== 'PENDING' || request.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'This review request is no longer open.' }, { status: 409 })
    }
    if (!request.requester.isActive) return NextResponse.json({ error: 'This member isn’t active right now.' }, { status: 409 })
    const partnerMap = await getPartnerMap([me, request.requesterId])
    if (await isBlockedBetween(sideOf(me, partnerMap), sideOf(request.requesterId, partnerMap))) {
      return NextResponse.json({ error: 'You can’t review this member.' }, { status: 403 })
    }
    const existing = await db.review.findUnique({
      where: { reviewerId_revieweeId: { reviewerId: me, revieweeId: request.requesterId } }, select: { id: true },
    })
    if (existing) {
      await db.reviewRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'COMPLETED' } })
      return NextResponse.json({ error: 'You’ve already reviewed this member.' }, { status: 409 })
    }

    let reviewId: string
    try {
      reviewId = await db.$transaction(async (tx) => {
        const claim = await tx.reviewRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'COMPLETED' } })
        if (claim.count !== 1) throw new Error('REQUEST_CLOSED')
        const r = await tx.review.create({
          data: { reviewerId: me, revieweeId: request.requesterId, requestId: request.id, ...ratings, comment, isExplicit },
          select: { id: true },
        })
        return r.id
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'REQUEST_CLOSED') return NextResponse.json({ error: 'This review request is no longer open.' }, { status: 409 })
      if ((e as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'You’ve already reviewed this member.' }, { status: 409 })
      throw e
    }

    const published = await publishIfMutual(reviewId)
    if (!published) await notifyReceived(reviewId, me, request.requesterId)

    let askBack: { ok: boolean; message: string } | undefined
    if (body.askBack === true) {
      const r = await createReviewRequest(me, request.requesterId)
      askBack = r.ok ? { ok: true, message: 'We’ve asked them to review you too.' } : { ok: false, message: r.message }
    }
    return NextResponse.json({ review: { id: reviewId, published }, ...(askBack ? { askBack } : {}) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/reviews error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
