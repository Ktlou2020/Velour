import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { CheckoutError, startMembershipCheckout } from '@/lib/membership-checkout'
import { PAYMENTS_NOT_CONFIGURED } from '@/lib/payments'
import { PaystackError, isBillingPeriod, isPaidTier } from '@/lib/paystack'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/checkout { tier: 'GOLD'|'PLATINUM', billing: 'monthly'|'annual' }
 * → { provider: 'PAYSTACK', redirectUrl } or { provider: 'PAYFAST', payfastUrl, paymentData }.
 * Prices come from the server (MEMBERSHIP_PRICES); 503 when no provider is configured.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { tier?: unknown; billing?: unknown }
    if (!isPaidTier(body.tier)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    if (!isBillingPeriod(body.billing)) return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })

    if (!rateLimit(`membership-checkout:${userId}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const checkout = await startMembershipCheckout(userId, body.tier, body.billing)
    if (!checkout) return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED }, { status: 503 })
    return NextResponse.json(checkout)
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof PaystackError) {
      console.error('POST /api/payment/checkout Paystack error:', error.message)
      return NextResponse.json({ error: 'We couldn’t reach our payment provider — please try again in a moment.' }, { status: 502 })
    }
    console.error('POST /api/payment/checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
