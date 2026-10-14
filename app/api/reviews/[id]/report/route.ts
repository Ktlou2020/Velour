import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { isValidId } from '@/lib/security'
import { sanitizeText } from '@/lib/review-text'

/**
 * POST /api/reviews/[id]/report — flag a published review for moderators.
 * Body: { reason, details? }. One report per member per review; admins get a
 * REPORT notification (same channel as /api/reports) linking to /admin/reviews.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`report:${me}`, 10, 60 * 60 * 1000)) return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const body = await req.json().catch(() => null) as { reason?: unknown; details?: unknown } | null
    const reason = sanitizeText(body?.reason, 100).slice(0, 100)
    const details = sanitizeText(body?.details, 1000).slice(0, 1000) || null
    if (!reason) return NextResponse.json({ error: 'Please choose a reason' }, { status: 400 })

    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, reviewerId: true, publishedAt: true, isHidden: true, reviewer: { select: { username: true } }, reviewee: { select: { username: true } } },
    })
    if (!review || !review.publishedAt || review.isHidden) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (review.reviewerId === me) return NextResponse.json({ error: 'You can’t report your own review' }, { status: 400 })

    const admins = await db.user.findMany({ where: { role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true }, take: 1 })
    const already = await db.notification.findFirst({
      where: {
        type: 'REPORT',
        AND: [{ data: { path: ['reviewId'], equals: id } }, { data: { path: ['reportedBy'], equals: me } }],
      },
      select: { id: true },
    })
    if (already) return NextResponse.json({ reported: true })

    await db.review.update({ where: { id }, data: { reportCount: { increment: 1 } } })
    if (admins[0]) {
      await db.notification.create({
        data: {
          userId: admins[0].id,
          type: 'REPORT',
          title: 'Review reported',
          body: `A review of @${review.reviewee.username} by @${review.reviewer.username} was reported. Reason: ${reason}`,
          data: { kind: 'REVIEW', reviewId: id, reportedBy: me, reportedUsername: review.reviewer.username, reason, details, url: '/admin/reviews' },
        },
      })
    } else {
      console.warn(`REVIEW REPORT not delivered (no admin account): reviewId=${id} reportedBy=${me} reason=${reason}`)
    }
    return NextResponse.json({ reported: true })
  } catch (error) {
    console.error('POST /api/reviews/[id]/report error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
