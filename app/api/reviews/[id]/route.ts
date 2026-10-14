import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { checkComment, parseRatings } from '@/lib/reviews'

/**
 * PATCH /api/reviews/[id] — the reviewer edits their review while it's still
 * hidden (before publication). Body: { ratings, comment, isExplicit? }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const ratings = parseRatings(body)
    if (!ratings) return NextResponse.json({ error: 'Please rate all five areas from 1 to 5 stars.' }, { status: 400 })
    const [comment, problem] = checkComment(body?.comment)
    if (problem) return NextResponse.json({ error: problem, field: 'comment' }, { status: 400 })

    const review = await db.review.findUnique({ where: { id }, select: { reviewerId: true, publishedAt: true } })
    if (!review || review.reviewerId !== me) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (review.publishedAt) return NextResponse.json({ error: 'This review is already published and can’t be edited.' }, { status: 409 })
    const r = await db.review.updateMany({
      where: { id, reviewerId: me, publishedAt: null },
      data: { ...ratings, comment, isExplicit: body?.isExplicit === true },
    })
    if (r.count === 0) return NextResponse.json({ error: 'This review is already published and can’t be edited.' }, { status: 409 })
    return NextResponse.json({ updated: true })
  } catch (error) {
    console.error('PATCH /api/reviews/[id] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
