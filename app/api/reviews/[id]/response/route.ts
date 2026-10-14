import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { isValidId } from '@/lib/security'
import { checkResponse } from '@/lib/reviews'

/**
 * POST /api/reviews/[id]/response — the reviewee's one public response
 * (≤ 500 chars) to a published review. Posting again edits it; an empty
 * response removes it. Body: { response }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`review:response:${me}`, 30, 60 * 60 * 1000)) return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const body = await req.json().catch(() => null) as { response?: unknown } | null
    const [text, problem] = checkResponse(body?.response)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    const review = await db.review.findUnique({ where: { id }, select: { revieweeId: true, publishedAt: true, isHidden: true } })
    if (!review || review.revieweeId !== me) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (!review.publishedAt || review.isHidden) return NextResponse.json({ error: 'You can respond once the review is public.' }, { status: 409 })
    const updated = await db.review.update({
      where: { id },
      data: text ? { response: text, responseAt: new Date() } : { response: null, responseAt: null },
      select: { response: true, responseAt: true },
    })
    return NextResponse.json({ response: updated.response, responseAt: updated.responseAt })
  } catch (error) {
    console.error('POST /api/reviews/[id]/response error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
