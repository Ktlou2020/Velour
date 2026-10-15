import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { resumeMembership } from '@/lib/subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST → resume my membership's renewal. { ok, message } or { error }. */
export async function POST() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`subscription-resume:${userId}`, 6, 10 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }
    const r = await resumeMembership(userId)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ ok: true, message: r.message })
  } catch (error) {
    console.error('POST /api/subscription/resume error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
