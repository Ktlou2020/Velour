import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { PAYMENTS_NOT_CONFIGURED } from '@/lib/payfast'
import { payfastMembershipForm } from '@/lib/membership-checkout'
import { isBillingPeriod, isPaidTier } from '@/lib/paystack'

/**
 * PayFast-only membership checkout (kept for compatibility). The upgrade page
 * uses the provider-agnostic POST /api/payment/checkout.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { tier?: unknown; billing?: unknown }
    if (!isPaidTier(body.tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }
    if (!isBillingPeriod(body.billing)) {
      return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, profile: { select: { displayName: true, foundingMemberNumber: true } } },
    })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.profile?.foundingMemberNumber != null) {
      return NextResponse.json({ error: "You're a founding member — Platinum is already yours, free forever." }, { status: 409 })
    }

    const form = payfastMembershipForm({ id: user.id, email: user.email, displayName: user.profile?.displayName ?? null }, body.tier, body.billing)
    if (!form) {
      return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED }, { status: 503 })
    }
    return NextResponse.json(form)
  } catch (error) {
    console.error('POST /api/payment/payfast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
