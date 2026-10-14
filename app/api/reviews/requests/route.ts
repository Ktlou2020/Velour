import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { isValidId } from '@/lib/security'
import { createReviewRequest } from '@/lib/reviews'
import { reviewsOverview } from '@/lib/reviews-overview'

export const dynamic = 'force-dynamic'

/** GET /api/reviews/requests — { received, sent } (declines show as pending to the requester). */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const o = await reviewsOverview(session.user.id)
    return NextResponse.json({ received: o.toWrite, sent: o.sent })
  } catch (error) {
    console.error('GET /api/reviews/requests error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/reviews/requests — ask someone for a review. Body: { userId } or { username }. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`review:request:${me}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }
    const body = await req.json().catch(() => null) as { userId?: unknown; username?: unknown } | null
    let target: { id: string } | null = null
    if (isValidId(body?.userId)) target = await db.user.findUnique({ where: { id: body!.userId as string }, select: { id: true } })
    else if (typeof body?.username === 'string' && body.username.length <= 64) {
      target = await db.user.findUnique({ where: { username: body.username }, select: { id: true } })
    } else return NextResponse.json({ error: 'userId or username is required' }, { status: 400 })
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const result = await createReviewRequest(me, target.id)
    if (!result.ok) {
      const status = result.reason === 'rate_limited' ? 429 : result.reason === 'not_found' ? 404 : result.reason === 'blocked' ? 403 : 409
      return NextResponse.json({ error: result.message, reason: result.reason }, { status })
    }
    return NextResponse.json({ request: { id: result.requestId } }, { status: 201 })
  } catch (error) {
    console.error('POST /api/reviews/requests error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/reviews/requests?id=… (or body { id }) — the requester cancels an open request. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => null) as { id?: unknown } | null
    const id = new URL(req.url).searchParams.get('id') ?? body?.id
    if (!isValidId(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const r = await db.reviewRequest.updateMany({
      where: { id, requesterId: me, status: { in: ['PENDING', 'DECLINED'] } },
      data: { status: 'CANCELLED' },
    })
    if (r.count === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    // The reviewer's notification would now lead to a closed request — remove it.
    await db.notification.deleteMany({
      where: { type: 'REVIEW_REQUEST', data: { path: ['requestId'], equals: id } },
    }).catch(() => {})
    return NextResponse.json({ cancelled: true })
  } catch (error) {
    console.error('DELETE /api/reviews/requests error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
