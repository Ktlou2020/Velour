import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  MEMBERSHIP_PRICES, amountToCents, parseItnBody, payfastConfig, validateWithPayfast, verifyItnSignature,
} from '@/lib/payfast'
import { applyStorePayment } from '@/lib/store/orders'

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
 *    otherwise a membership payment (custom_str1 = userId, item_name "Hush Gold"/"Hush Platinum").
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
        select: { id: true, number: true, status: true, totalCents: true, pfPaymentId: true, adminNotes: true },
      })
      if (order) {
        const outcome = await applyStorePayment(order, { paymentStatus, pfPaymentId, amountGrossCents })
        console.log(`PayFast ITN: store order ${order.number} ${paymentStatus} → ${outcome}`)
        return text('OK', 200)
      }
    }

    // ── Membership (unchanged behaviour, plus amount check + replay guard) ──
    if (paymentStatus === 'COMPLETE') {
      const userId = (params.custom_str1 ?? '').trim()
      const itemName = params.item_name ?? ''

      if (userId) {
        let tier: 'GOLD' | 'PLATINUM' = 'GOLD'
        if (itemName.toLowerCase().includes('platinum')) {
          tier = 'PLATINUM'
        }

        const allowed = Object.values(MEMBERSHIP_PRICES[tier]).map((r) => Math.round(r * 100))
        if (amountGrossCents === null || !allowed.some((c) => Math.abs(c - amountGrossCents) <= 1)) {
          console.warn(`PayFast ITN: membership amount ${params.amount_gross} does not match ${tier} pricing — ignored`)
          return text('OK', 200)
        }

        const profile = await db.profile.findUnique({ where: { userId }, select: { userId: true } })
        if (!profile) {
          console.warn('PayFast ITN: membership payment for unknown user — ignored')
          return text('OK', 200)
        }

        await db.profile.update({
          where: { userId },
          data: { membershipTier: tier },
        })

        // Replays (same pf_payment_id) don't notify twice.
        const seen = pfPaymentId
          ? await db.notification.findFirst({
              where: { userId, type: 'PAYMENT', data: { path: ['pfPaymentId'], equals: pfPaymentId } },
              select: { id: true },
            })
          : null
        if (!seen) {
          await db.notification.create({
            data: {
              userId,
              type: 'PAYMENT',
              title: 'Membership Activated',
              body: `Your ${tier} membership is now active. Enjoy all the benefits!`,
              data: { tier, itemName, url: '/subscription', ...(pfPaymentId ? { pfPaymentId } : {}) },
            },
          })
        }
      }
    }

    return text('OK', 200)
  } catch (error) {
    console.error('POST /api/payment/payfast/notify error:', error)
    // A verified notification we failed to process: ask PayFast to retry.
    return text('Error', 500)
  }
}
