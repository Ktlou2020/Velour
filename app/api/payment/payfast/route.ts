import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import crypto from 'crypto'
import { db } from '@/lib/db'

const PRICES: Record<string, Record<string, number>> = {
  GOLD: {
    monthly: 199.0,
    annual: 1668.0, // 139/mo
  },
  PLATINUM: {
    monthly: 349.0,
    annual: 2988.0, // 249/mo
  },
}

function buildSignature(params: Record<string, string>, passphrase?: string): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => k !== 'signature' && params[k] !== '')
    .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&')

  const str = passphrase ? `${sorted}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : sorted
  return crypto.createHash('md5').update(str).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
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

    const amount = PRICES[tier][billing].toFixed(2)
    const itemName = tier === 'GOLD' ? 'Velour Gold' : 'Velour Platinum'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const today = new Date().toISOString().split('T')[0]
    // frequency: 3 = monthly, 6 = annual
    const frequency = billing === 'monthly' ? '3' : '6'

    const nameParts = (user?.profile?.displayName ?? '').split(' ')
    const nameFirst = nameParts[0] ?? ''

    const params: Record<string, string> = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID ?? '',
      merchant_key: process.env.PAYFAST_MERCHANT_KEY ?? '',
      return_url: `${appUrl}/members?upgraded=1`,
      cancel_url: `${appUrl}/upgrade`,
      notify_url: `${appUrl}/api/payment/payfast/notify`,
      name_first: nameFirst,
      email_address: user?.email ?? '',
      item_name: itemName,
      amount,
      subscription_type: '1',
      billing_date: today,
      recurring_amount: amount,
      frequency,
      cycles: '0',
      custom_str1: session.user.id,
    }

    const passphrase = process.env.PAYFAST_PASSPHRASE
    const signature = buildSignature(params, passphrase)
    params.signature = signature

    return NextResponse.json({
      paymentData: params,
      payfastUrl: 'https://www.payfast.co.za/eng/process',
    })
  } catch (error) {
    console.error('POST /api/payment/payfast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
