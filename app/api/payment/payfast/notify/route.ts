import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

function buildSignature(params: Record<string, string>, passphrase?: string): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => k !== 'signature' && params[k] !== '')
    .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&')

  const str = passphrase
    ? `${sorted}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : sorted
  return crypto.createHash('md5').update(str).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    const params: Record<string, string> = {}
    new URLSearchParams(text).forEach((value, key) => {
      params[key] = value
    })

    const receivedSignature = params.signature ?? ''

    // Verify signature
    const passphrase = process.env.PAYFAST_PASSPHRASE
    const expectedSignature = buildSignature(params, passphrase)

    if (receivedSignature !== expectedSignature) {
      console.warn('PayFast ITN: invalid signature')
      return new Response('Invalid signature', { status: 400 })
    }

    const paymentStatus = params.payment_status
    if (paymentStatus === 'COMPLETE') {
      const userId = params.custom_str1
      const itemName = params.item_name ?? ''

      if (userId) {
        let tier: 'GOLD' | 'PLATINUM' = 'GOLD'
        if (itemName.toLowerCase().includes('platinum')) {
          tier = 'PLATINUM'
        }

        await db.profile.update({
          where: { userId },
          data: { membershipTier: tier },
        })

        await db.notification.create({
          data: {
            userId,
            type: 'PAYMENT',
            title: 'Membership Activated',
            body: `Your ${tier} membership is now active. Enjoy all the benefits!`,
            data: { tier, itemName },
          },
        })
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('POST /api/payment/payfast/notify error:', error)
    return new Response('OK', { status: 200 }) // Always return 200 to PayFast
  }
}
