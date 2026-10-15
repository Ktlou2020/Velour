import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { manageCardLink } from '@/lib/subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST → { url } of Paystack's hosted page for updating the card on my subscription. */
export async function POST() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`subscription-manage:${userId}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }
    const r = await manageCardLink(userId)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ url: r.url })
  } catch (error) {
    console.error('POST /api/subscription/manage error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
