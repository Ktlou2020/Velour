import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { MEMBERSHIP_PRICES, PAYMENTS_NOT_CONFIGURED, buildCheckoutFields, membershipItemName, payfastConfig } from '@/lib/payfast'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cfg = payfastConfig()
    if (!cfg) {
      return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const { tier, billing } = body as {
      tier?: 'GOLD' | 'PLATINUM'
      billing?: 'monthly' | 'annual'
    }

    if (!tier || !['GOLD', 'PLATINUM'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }
    if (!billing || !['monthly', 'annual'].includes(billing)) {
      return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, profile: { select: { displayName: true } } },
    })

    const amount = MEMBERSHIP_PRICES[tier][billing].toFixed(2)
    const itemName = membershipItemName(tier)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const today = new Date().toISOString().split('T')[0]
    // frequency: 3 = monthly, 6 = annual
    const frequency = billing === 'monthly' ? '3' : '6'

    const nameParts = (user?.profile?.displayName ?? '').split(' ')
    const nameFirst = nameParts[0] ?? ''

    // Same fields as before; signed in PayFast's documented field order
    // (lib/payfast.ts) instead of alphabetically.
    const pairs = buildCheckoutFields({
      merchant_id: cfg.merchantId,
      merchant_key: cfg.merchantKey,
      return_url: `${appUrl}/members?upgraded=1`,
      cancel_url: `${appUrl}/upgrade`,
      notify_url: `${appUrl}/api/payment/payfast/notify`,
      name_first: nameFirst,
      email_address: user?.email ?? '',
      amount,
      item_name: itemName,
      custom_str1: session.user.id,
      subscription_type: '1',
      billing_date: today,
      recurring_amount: amount,
      frequency,
      cycles: '0',
    }, cfg.passphrase)

    // Insertion order = signing order, so the client's form posts them in order.
    const paymentData: Record<string, string> = {}
    for (const [k, v] of pairs) paymentData[k] = v

    return NextResponse.json({
      paymentData,
      payfastUrl: cfg.processUrl,
    })
  } catch (error) {
    console.error('POST /api/payment/payfast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
