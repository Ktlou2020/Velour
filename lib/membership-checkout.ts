/**
 * Start a membership checkout with the active provider (server only).
 *  - Paystack: transaction/initialize with the plan code (auto-renewing
 *    subscription) → redirect to authorization_url. Without a usable plan,
 *    a one-off charge for the period (no auto-renew).
 *  - PayFast: signed recurring-billing form (unchanged behaviour).
 */
import crypto from 'crypto'
import { db } from '@/lib/db'
import { MEMBERSHIP_PRICES, buildCheckoutFields, membershipItemName, payfastConfig } from '@/lib/payfast'
import { activePaymentProvider, appUrl } from '@/lib/payments'
import { PlanMisconfiguredError, initializeTransaction, membershipPriceCents, resolvePlanCode, type BillingPeriod, type PaidTier } from '@/lib/paystack'
import { currentSubscription } from '@/lib/subscriptions'

export type MembershipCheckout =
  | { provider: 'PAYSTACK'; redirectUrl: string; recurring: boolean }
  | { provider: 'PAYFAST'; payfastUrl: string; paymentData: Record<string, string> }

export class CheckoutError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Signed PayFast recurring-billing form for a membership. */
export function payfastMembershipForm(user: { id: string; email: string; displayName: string | null }, tier: PaidTier, billing: BillingPeriod) {
  const cfg = payfastConfig()
  if (!cfg) return null
  const amount = MEMBERSHIP_PRICES[tier][billing].toFixed(2)
  const base = appUrl()
  const today = new Date().toISOString().split('T')[0]
  const pairs = buildCheckoutFields({
    merchant_id: cfg.merchantId,
    merchant_key: cfg.merchantKey,
    return_url: `${base}/members?upgraded=1`,
    cancel_url: `${base}/upgrade`,
    notify_url: `${base}/api/payment/payfast/notify`,
    name_first: (user.displayName ?? '').split(' ')[0] ?? '',
    email_address: user.email,
    amount,
    item_name: membershipItemName(tier),
    custom_str1: user.id,
    custom_str2: billing,
    subscription_type: '1',
    billing_date: today,
    recurring_amount: amount,
    // frequency: 3 = monthly, 6 = annual
    frequency: billing === 'monthly' ? '3' : '6',
    cycles: '0',
  }, cfg.passphrase)
  // Insertion order = signing order, so the client's form posts them in order.
  const paymentData: Record<string, string> = {}
  for (const [k, v] of pairs) paymentData[k] = v
  return { payfastUrl: cfg.processUrl, paymentData }
}

export async function startMembershipCheckout(userId: string, tier: PaidTier, billing: BillingPeriod): Promise<MembershipCheckout | null> {
  const provider = activePaymentProvider()
  if (!provider) return null

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, profile: { select: { displayName: true } } } })
  if (!user) throw new CheckoutError(401, 'Unauthorized')

  const current = await currentSubscription(userId)
  if (current && current.tier === tier && current.period === billing && current.status === 'ACTIVE' && !current.cancelAtPeriodEnd) {
    throw new CheckoutError(409, 'You’re already on this plan.')
  }

  if (provider === 'PAYFAST') {
    const form = payfastMembershipForm({ id: user.id, email: user.email, displayName: user.profile?.displayName ?? null }, tier, billing)
    return form ? { provider, ...form } : null
  }

  let plan: string | null
  try {
    plan = await resolvePlanCode(tier, billing)
  } catch (e) {
    if (e instanceof PlanMisconfiguredError) {
      console.error('[paystack] plan misconfigured:', e.message)
      throw new CheckoutError(503, 'Upgrades are briefly unavailable — please try again later.')
    }
    throw e
  }
  const r = await initializeTransaction({
    email: user.email,
    amountCents: membershipPriceCents(tier, billing),
    reference: `UBM-${crypto.randomBytes(12).toString('hex')}`,
    // Paystack appends ?trxref=…&reference=…; /subscription verifies it server-side.
    callbackUrl: `${appUrl()}/subscription`,
    ...(plan ? { plan, channels: ['card'] } : {}),
    metadata: {
      kind: 'membership', userId, tier, period: billing,
      custom_fields: [{ display_name: 'Plan', variable_name: 'plan', value: `${membershipItemName(tier)} (${billing})` }],
    },
  })
  return { provider, redirectUrl: r.authorization_url, recurring: !!plan }
}
