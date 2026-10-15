import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  MEMBERSHIP_PRICES, amountToCents, parseItnBody, payfastConfig, validateWithPayfast, verifyItnSignature,
} from '@/lib/payfast'
import { isBillingPeriod } from '@/lib/paystack'
import { applyStorePayment } from '@/lib/store/orders'
import { markNotRenewing, recordMembershipPayment, recordStorePayment } from '@/lib/subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(body: string, status: number) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })
}

/**
 * PayFast ITN (Instant Transaction Notification).
 *
 * 1. Parse the raw body keeping PayFast's field order.
 * 2. Verify the signature (received order, minus `signature`, + passphrase) → 400 if wrong.
 * 3. Check merchant_id is ours → 400 if not.
 * 4. Confirm with PayFast server-to-server (/eng/query/validate → "VALID");
 *    network trouble → 503 so PayFast retries. (PAYFAST_SKIP_VALIDATE=true skips this for local tests.)
 * 5. Route: m_payment_id matching an Order.paymentRef → store order;
 *    otherwise a membership payment (custom_str1 = userId, item_name "Unbound Gold"/"Unbound Platinum",
 *    custom_str2 = billing period, `token` = PayFast subscription token) → Subscription + Payment
 *    (lib/subscriptions.ts). payment_status CANCELLED with a token → the membership stops renewing.
 * Valid-but-ignored notifications get 200 so PayFast stops retrying.
 */
export async function POST(req: NextRequest) {
  let pairs: [string, string][]
  try {
    pairs = parseItnBody(await req.text())
  } catch {
    return text('Bad request', 400)
  }
  const params: Record<string, string> = {}
  for (const [k, v] of pairs) params[k] = v

  const cfg = payfastConfig()
  if (!cfg) {
    console.error('PayFast ITN received but PayFast is not configured')
    return text('Not configured', 503)
  }

  if (!verifyItnSignature(pairs, cfg.passphrase)) {
    console.warn('PayFast ITN: invalid signature')
    return text('Invalid signature', 400)
  }
  if ((params.merchant_id ?? '').trim() !== cfg.merchantId) {
    console.warn('PayFast ITN: merchant_id mismatch')
    return text('Invalid merchant', 400)
  }

  const validation = await validateWithPayfast(pairs, cfg)
  if (validation === 'ERROR') return text('Validation unavailable', 503)
  if (validation === 'INVALID') {
    console.warn('PayFast ITN: PayFast did not confirm the notification')
    return text('Invalid', 400)
  }

  try {
    const paymentStatus = (params.payment_status ?? '').trim().toUpperCase()
    const pfPaymentId = (params.pf_payment_id ?? '').trim()
    const amountGrossCents = amountToCents(params.amount_gross)
    const mPaymentId = (params.m_payment_id ?? '').trim()

    // ── Store orders ──
    if (mPaymentId) {
      const order = await db.order.findUnique({
        where: { paymentRef: mPaymentId },
        select: { id: true, number: true, userId: true, status: true, totalCents: true, pfPaymentId: true, adminNotes: true },
      })
      if (order) {
        const outcome = await applyStorePayment(order, { paymentStatus, pfPaymentId, amountGrossCents })
        if (pfPaymentId && amountGrossCents !== null && (outcome === 'paid' || outcome === 'duplicate' || outcome === 'late_unfulfillable')) {
          await recordStorePayment({ userId: order.userId, provider: 'PAYFAST', reference: `PF-${pfPaymentId.slice(0, 90)}`, amountCents: amountGrossCents, currency: 'ZAR', orderId: order.id })
        }
        console.log(`PayFast ITN: store order ${order.number} ${paymentStatus} → ${outcome}`)
        return text('OK', 200)
      }
    }

    // ── Membership ──
    const token = (params.token ?? '').trim()

    // Subscription cancelled at PayFast (by the member, us or PayFast): keep access until the period ends.
    if (paymentStatus === 'CANCELLED' && token) {
      const row = await db.subscription.findUnique({ where: { payfastToken: token } })
      if (row) await markNotRenewing(row, 'payfast ITN CANCELLED')
      return text('OK', 200)
    }

    if (paymentStatus === 'COMPLETE') {
      const userId = (params.custom_str1 ?? '').trim()
      const itemName = params.item_name ?? ''

      if (userId) {
        let tier: 'GOLD' | 'PLATINUM' = 'GOLD'
        if (itemName.toLowerCase().includes('platinum')) {
          tier = 'PLATINUM'
        }

        // Period: custom_str2 (newer checkouts) or whichever price the amount matches.
        const hinted = (params.custom_str2 ?? '').trim()
        const matches = (Object.keys(MEMBERSHIP_PRICES[tier]) as ('monthly' | 'annual')[])
          .filter((p) => amountGrossCents !== null && Math.abs(Math.round(MEMBERSHIP_PRICES[tier][p] * 100) - amountGrossCents) <= 1)
        const period = isBillingPeriod(hinted) && matches.includes(hinted) ? hinted : matches[0]
        if (!period) {
          console.warn(`PayFast ITN: membership amount ${params.amount_gross} does not match ${tier} pricing — ignored`)
          return text('OK', 200)
        }

        const profile = await db.profile.findUnique({ where: { userId }, select: { userId: true } })
        if (!profile) {
          console.warn('PayFast ITN: membership payment for unknown user — ignored')
          return text('OK', 200)
        }
        if (!pfPaymentId) {
          console.warn('PayFast ITN: membership payment without pf_payment_id — ignored')
          return text('OK', 200)
        }

        // Idempotent on pf_payment_id: activates/extends the Subscription, records
        // the Payment, writes the PAYMENT notification (admin analytics) and emails a receipt.
        const r = await recordMembershipPayment({
          userId,
          provider: 'PAYFAST',
          reference: `PF-${pfPaymentId.slice(0, 90)}`,
          amountCents: amountGrossCents ?? Math.round(MEMBERSHIP_PRICES[tier][period] * 100),
          currency: 'ZAR',
          tier,
          period,
          payfast: { token: /^[A-Za-z0-9-]{8,64}$/.test(token) ? token : null },
          raw: { pf_payment_id: pfPaymentId, payment_status: paymentStatus, amount_gross: params.amount_gross ?? null, item_name: itemName, billing_date: params.billing_date ?? null },
          notificationData: { itemName, pfPaymentId },
        })
        console.log(`PayFast ITN: membership ${tier} ${period} → ${r.outcome}`)
      }
    }

    return text('OK', 200)
  } catch (error) {
    console.error('POST /api/payment/payfast/notify error:', error)
    // A verified notification we failed to process: ask PayFast to retry.
    return text('Error', 500)
  }
}
