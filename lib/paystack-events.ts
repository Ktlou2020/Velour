/**
 * Applying verified Paystack data (server only). Used by the webhook and by
 * the callback pages, which verify the reference with Paystack first — query
 * parameters are never trusted on their own. Everything here is idempotent:
 * memberships on Payment.reference, store orders on Order.pfPaymentId.
 */
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import {
  PAYSTACK_CURRENCY, isBillingPeriod, isPaidTier, membershipPriceCents, metadataOf, planCodeOf, tierForPlanCode, tierForPlanObject,
  verifyTransaction, type BillingPeriod, type PaidTier, type PaystackPlan, type PaystackSubscription, type PaystackTransaction,
} from '@/lib/paystack'
import { alertBilling, fillPaystackCodes, markNotRenewing, markPastDue, recordMembershipPayment, recordStorePayment, OPEN_STATUSES } from '@/lib/subscriptions'
import { applyStorePayment, type PaymentOutcome } from '@/lib/store/orders'
import { STORE_PAYMENT_MARKER, paymentRefFromReference } from '@/lib/store/payment'

export type ChargeResult =
  | { kind: 'store'; outcome: PaymentOutcome; orderNumber: string }
  | { kind: 'membership'; outcome: 'recorded' | 'duplicate' | 'unwanted' | 'amount_mismatch' | 'unknown_plan' | 'unknown_user' | 'not_yours' }
  | { kind: 'ignored'; reason: string }

/** Small, secret-free copy of the transaction for Payment.raw. */
function rawOf(tx: PaystackTransaction): Prisma.InputJsonValue {
  return {
    id: tx.id, reference: tx.reference, status: tx.status, amount: tx.amount, currency: tx.currency,
    paid_at: tx.paid_at ?? tx.paidAt ?? null, channel: tx.channel ?? null,
    customer: tx.customer?.customer_code ?? null, plan: planCodeOf(tx),
  }
}

async function userIdFor(tx: PaystackTransaction, meta: Record<string, unknown>): Promise<string | null> {
  if (isValidId(meta.userId)) {
    const u = await db.user.findUnique({ where: { id: meta.userId }, select: { id: true } })
    if (u) return u.id
  }
  const cust = tx.customer?.customer_code
  if (cust) {
    const row = await db.subscription.findFirst({ where: { provider: 'PAYSTACK', providerCustomerCode: cust }, orderBy: { createdAt: 'desc' }, select: { userId: true } })
    if (row) return row.userId
  }
  const email = tx.customer?.email?.trim()
  if (email) {
    const u = (await db.user.findUnique({ where: { email }, select: { id: true } }))
      ?? (await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }))
    if (u) return u.id
  }
  return null
}

async function planFor(tx: PaystackTransaction, meta: Record<string, unknown>, userId: string, planCode: string | null): Promise<{ tier: PaidTier; period: BillingPeriod } | null> {
  if (isPaidTier(meta.tier) && isBillingPeriod(meta.period)) return { tier: meta.tier, period: meta.period }
  const fromCode = tierForPlanCode(planCode)
  if (fromCode) return fromCode
  if (planCode) {
    const row = await db.subscription.findFirst({ where: { userId, provider: 'PAYSTACK', providerPlanCode: planCode }, orderBy: { createdAt: 'desc' }, select: { tier: true, period: true } })
    if (row && isPaidTier(row.tier) && isBillingPeriod(row.period)) return { tier: row.tier, period: row.period }
  }
  const planObj = (tx.plan && typeof tx.plan === 'object' ? tx.plan : tx.plan_object) as PaystackPlan | null | undefined
  return tierForPlanObject(planObj)
}

/**
 * Apply a successful Paystack charge (already verified: it came from a
 * signed webhook or from GET /transaction/verify). `expectUserId` (callback
 * pages) refuses to apply someone else's transaction.
 */
export async function applyPaystackCharge(tx: PaystackTransaction, opts: { expectUserId?: string } = {}): Promise<ChargeResult> {
  if (tx.status !== 'success') return { kind: 'ignored', reason: `status ${tx.status}` }
  const meta = metadataOf(tx)
  const currencyOk = (tx.currency ?? '').toUpperCase() === PAYSTACK_CURRENCY
  const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount)

  // ── Store order ──
  const paymentRef = paymentRefFromReference(tx.reference ?? '')
  if (paymentRef || meta.kind === STORE_PAYMENT_MARKER) {
    const order = paymentRef
      ? await db.order.findUnique({ where: { paymentRef }, select: { id: true, number: true, userId: true, status: true, totalCents: true, pfPaymentId: true, adminNotes: true } })
      : null
    if (order) {
      if (opts.expectUserId && order.userId !== opts.expectUserId) return { kind: 'ignored', reason: 'not_yours' }
      const outcome = await applyStorePayment(order, {
        paymentStatus: 'COMPLETE',
        pfPaymentId: `paystack:${tx.reference}`,
        amountGrossCents: currencyOk && Number.isFinite(amount) ? Math.round(amount) : null,
        provider: 'Paystack',
      })
      if (outcome === 'paid' || outcome === 'duplicate' || outcome === 'late_unfulfillable') {
        await recordStorePayment({ userId: order.userId, provider: 'PAYSTACK', reference: tx.reference, amountCents: Math.round(amount), currency: PAYSTACK_CURRENCY, orderId: order.id, raw: rawOf(tx) })
      }
      console.log(`[paystack] store order ${order.number} → ${outcome}`)
      return { kind: 'store', outcome, orderNumber: order.number }
    }
    if (meta.kind === STORE_PAYMENT_MARKER) {
      await alertBilling('Paystack store payment for an unknown order', `Paystack transaction ${tx.reference} (${amount} ${tx.currency}) is marked as a store payment but matches no order. Check it in the Paystack dashboard.`)
      return { kind: 'ignored', reason: 'unknown_order' }
    }
  }

  // ── Membership ──
  const planCode = planCodeOf(tx)
  if (!planCode && meta.kind !== 'membership') return { kind: 'ignored', reason: 'not ours' }
  const userId = await userIdFor(tx, meta)
  if (!userId) {
    await alertBilling('Paystack membership payment for an unknown member', `Paystack transaction ${tx.reference} (${amount} ${tx.currency}) couldn't be matched to a member. Check it in the Paystack dashboard.`)
    return { kind: 'membership', outcome: 'unknown_user' }
  }
  if (opts.expectUserId && userId !== opts.expectUserId) return { kind: 'membership', outcome: 'not_yours' }
  const plan = await planFor(tx, meta, userId, planCode)
  if (!plan) {
    await alertBilling('Paystack payment for an unknown plan', `Paystack transaction ${tx.reference} for member ${userId} (plan ${planCode ?? 'none'}) doesn't match a membership plan. Nothing was activated.`)
    return { kind: 'membership', outcome: 'unknown_plan' }
  }
  const expected = membershipPriceCents(plan.tier, plan.period)
  if (!currencyOk || !Number.isFinite(amount) || Math.round(amount) !== expected) {
    await alertBilling('Membership payment amount mismatch', `Paystack transaction ${tx.reference} for member ${userId} was ${amount} ${tx.currency}; ${plan.tier} ${plan.period} costs ${expected} ${PAYSTACK_CURRENCY} (cents). Nothing was activated.`)
    return { kind: 'membership', outcome: 'amount_mismatch' }
  }
  const paidAtRaw = tx.paid_at ?? tx.paidAt
  const r = await recordMembershipPayment({
    userId,
    provider: 'PAYSTACK',
    reference: tx.reference,
    amountCents: expected,
    currency: PAYSTACK_CURRENCY,
    tier: plan.tier,
    period: plan.period,
    paidAt: paidAtRaw ? new Date(paidAtRaw) : undefined,
    newCheckout: meta.kind === 'membership',
    paystack: { customerCode: tx.customer?.customer_code ?? null, planCode },
    raw: rawOf(tx),
  })
  // First charge of a plan: the subscription code arrives separately (subscription.create); try to fetch it now too.
  if (r.outcome === 'recorded' && planCode && r.subscriptionId) await fillPaystackCodes(r.subscriptionId).catch(() => {})
  return { kind: 'membership', outcome: r.outcome }
}

/** Verify a reference with Paystack and apply it (callback pages). Null when it can't be verified. */
export async function verifyAndApply(reference: string, expectUserId: string): Promise<{ tx: PaystackTransaction; result: ChargeResult } | null> {
  try {
    const tx = await verifyTransaction(reference)
    if (tx.reference !== reference) return null
    const result = await applyPaystackCharge(tx, { expectUserId })
    return { tx, result }
  } catch (e) {
    console.warn('[paystack] verify on callback failed:', e instanceof Error ? e.message : e)
    return null
  }
}

// ─── Webhook events ────────────────────────────────────────────────────────

export type EventOutcome = 'handled' | 'ignored' | 'retry'

interface PaystackInvoice {
  status?: string // success | failed | pending
  paid?: boolean
  subscription?: PaystackSubscription | null
}

async function rowByCode(code: string | undefined | null) {
  if (!code) return null
  return db.subscription.findUnique({ where: { providerSubscriptionCode: code } })
}

async function onSubscriptionCreate(s: PaystackSubscription): Promise<EventOutcome> {
  if (!s.subscription_code) return 'ignored'
  const next = s.next_payment_date ? new Date(s.next_payment_date) : null
  const existing = await rowByCode(s.subscription_code)
  const row = existing ?? (s.customer?.customer_code && s.plan?.plan_code
    ? await db.subscription.findFirst({
        where: { provider: 'PAYSTACK', providerCustomerCode: s.customer.customer_code, providerPlanCode: s.plan.plan_code, providerSubscriptionCode: null, status: { in: OPEN_STATUSES } },
        orderBy: { createdAt: 'desc' },
      })
    : null)
  if (!row) {
    // Usually charge.success (which creates the row) arrives first; if not, ask Paystack to retry for a while.
    const created = s.createdAt ? new Date(s.createdAt).getTime() : Date.now()
    return Date.now() - created < 24 * 60 * 60 * 1000 ? 'retry' : 'ignored'
  }
  await db.subscription.update({
    where: { id: row.id },
    data: {
      providerSubscriptionCode: s.subscription_code,
      ...(s.email_token ? { emailToken: s.email_token } : {}),
      ...(next && !Number.isNaN(next.getTime()) && next > row.currentPeriodEnd && row.status !== 'EXPIRED' ? { currentPeriodEnd: next } : {}),
    },
  })
  return 'handled'
}

/**
 * Handle one verified webhook event. 'retry' → respond 500 so Paystack
 * redelivers; everything else → 200. Throws on database errors (→ 500).
 */
export async function handlePaystackEvent(event: string, data: unknown): Promise<EventOutcome> {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  switch (event) {
    case 'charge.success': {
      const r = await applyPaystackCharge(d as unknown as PaystackTransaction)
      return r.kind === 'ignored' ? 'ignored' : 'handled'
    }
    case 'subscription.create':
      return onSubscriptionCreate(d as unknown as PaystackSubscription)
    case 'subscription.not_renew':
    case 'subscription.disable': {
      const s = d as unknown as PaystackSubscription
      const row = await rowByCode(s.subscription_code)
      if (!row) return 'ignored'
      if (s.email_token && !row.emailToken) await db.subscription.update({ where: { id: row.id }, data: { emailToken: s.email_token } })
      await markNotRenewing(row, event)
      return 'handled'
    }
    case 'invoice.payment_failed':
    case 'invoice.update': {
      const inv = d as PaystackInvoice
      if (event === 'invoice.update' && !(inv.status === 'failed' || (inv.paid === false && inv.status !== 'pending' && inv.status !== 'success'))) return 'ignored'
      const row = await rowByCode(inv.subscription?.subscription_code)
      if (!row) return 'ignored'
      await markPastDue(row)
      return 'handled'
    }
    default:
      return 'ignored'
  }
}
