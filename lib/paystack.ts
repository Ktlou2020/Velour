/**
 * Paystack helpers (server only): config, REST calls, plan resolution and
 * webhook signature checks. Paystack is the primary payment provider when
 * PAYSTACK_SECRET_KEY is set; PayFast (lib/payfast.ts) is the fallback.
 *
 * Amounts are in the currency's subunit — for ZAR that's cents (R199 = 19900).
 *
 * Env:
 *   PAYSTACK_SECRET_KEY            required (sk_live_… / sk_test_…) — also signs webhooks
 *   PAYSTACK_PUBLIC_KEY            optional (not needed for the redirect checkout)
 *   PAYSTACK_PLAN_GOLD_MONTHLY     optional plan codes (PLN_…). When one is missing the
 *   PAYSTACK_PLAN_GOLD_ANNUAL      plan is looked up by name/amount/interval on Paystack,
 *   PAYSTACK_PLAN_PLATINUM_MONTHLY created if it doesn't exist, and cached in memory. If
 *   PAYSTACK_PLAN_PLATINUM_ANNUAL  that fails too, checkout falls back to a one-off charge
 *                                  for the period (no auto-renew).
 *
 * Never log the secret key, email tokens or full API responses.
 */
import crypto from 'crypto'
import { MEMBERSHIP_PRICES, membershipItemName } from '@/lib/payfast'

export const PAYSTACK_API = 'https://api.paystack.co'
export const PAYSTACK_CURRENCY = 'ZAR'

export type PaidTier = 'GOLD' | 'PLATINUM'
export type BillingPeriod = 'monthly' | 'annual'

export interface PaystackConfig {
  secretKey: string
  publicKey: string | null
  testMode: boolean
}

export function paystackConfig(): PaystackConfig | null {
  const secretKey = (process.env.PAYSTACK_SECRET_KEY ?? '').trim()
  if (!secretKey) return null
  return {
    secretKey,
    publicKey: (process.env.PAYSTACK_PUBLIC_KEY ?? '').trim() || null,
    testMode: secretKey.startsWith('sk_test_'),
  }
}

/** Membership price in cents (server-side source of truth). */
export function membershipPriceCents(tier: PaidTier, period: BillingPeriod): number {
  return Math.round(MEMBERSHIP_PRICES[tier][period] * 100)
}

export function isPaidTier(v: unknown): v is PaidTier {
  return v === 'GOLD' || v === 'PLATINUM'
}

export function isBillingPeriod(v: unknown): v is BillingPeriod {
  return v === 'monthly' || v === 'annual'
}

// ─── HTTP ─────────────────────────────────────────────────────────────────

export class PaystackError extends Error {
  constructor(message: string, public httpStatus: number | null) {
    super(message)
  }
}

interface Envelope<T> { status: boolean; message: string; data: T }

async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const cfg = paystackConfig()
  if (!cfg) throw new PaystackError('Paystack is not configured', null)
  let res: Response
  try {
    res = await fetch(`${PAYSTACK_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch (e) {
    throw new PaystackError(`Paystack request failed: ${e instanceof Error ? e.message : 'network error'}`, null)
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !json || json.status !== true) {
    // Paystack's message is safe to log (no secrets); keep it short.
    const msg = (json?.message ?? `HTTP ${res.status}`).toString().slice(0, 200)
    throw new PaystackError(msg, res.status)
  }
  return json.data
}

// ─── Types (only the fields we use) ────────────────────────────────────────

export interface PaystackPlan {
  id?: number
  name?: string
  plan_code: string
  amount?: number
  interval?: string
  currency?: string
}

export interface PaystackCustomer {
  id?: number
  email?: string
  customer_code?: string
}

export interface PaystackTransaction {
  id: number
  status: string // success | failed | abandoned | …
  reference: string
  amount: number
  currency: string
  paid_at?: string | null
  paidAt?: string | null
  channel?: string
  metadata?: unknown
  customer?: PaystackCustomer
  /** Webhook: object ({} when none). Verify endpoint: plan code string or null. */
  plan?: PaystackPlan | string | null | Record<string, never>
  plan_object?: PaystackPlan | Record<string, never> | null
}

export interface PaystackSubscription {
  subscription_code: string
  email_token?: string
  status?: string // active | non-renewing | attention | completed | cancelled
  next_payment_date?: string | null
  createdAt?: string
  plan?: PaystackPlan
  customer?: PaystackCustomer
}

// ─── Transactions ──────────────────────────────────────────────────────────

export interface InitializeInput {
  email: string
  amountCents: number
  reference?: string
  callbackUrl: string
  plan?: string
  metadata: Record<string, unknown>
  channels?: string[]
}

export async function initializeTransaction(input: InitializeInput): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  return call('POST', '/transaction/initialize', {
    email: input.email,
    amount: String(Math.round(input.amountCents)),
    currency: PAYSTACK_CURRENCY,
    callback_url: input.callbackUrl,
    ...(input.reference ? { reference: input.reference } : {}),
    ...(input.plan ? { plan: input.plan } : {}),
    ...(input.channels ? { channels: input.channels } : {}),
    metadata: input.metadata,
  })
}

/** Paystack reference charset: letters, digits, '-', '.', '='. */
export function isValidReference(ref: unknown): ref is string {
  return typeof ref === 'string' && /^[A-Za-z0-9.=-]{1,100}$/.test(ref)
}

export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  if (!isValidReference(reference)) throw new PaystackError('Invalid reference', 400)
  return call('GET', `/transaction/verify/${encodeURIComponent(reference)}`)
}

/** Metadata as an object (Paystack may hand it back as a JSON string). */
export function metadataOf(tx: { metadata?: unknown }): Record<string, unknown> {
  let m = tx.metadata
  if (typeof m === 'string') {
    try { m = JSON.parse(m) } catch { return {} }
  }
  return m && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : {}
}

export function planCodeOf(tx: PaystackTransaction): string | null {
  if (typeof tx.plan === 'string' && tx.plan) return tx.plan
  const p = (tx.plan && typeof tx.plan === 'object' ? tx.plan : null) as PaystackPlan | null
  if (p?.plan_code) return p.plan_code
  const po = tx.plan_object as PaystackPlan | null | undefined
  return po?.plan_code ?? null
}

// ─── Subscriptions ─────────────────────────────────────────────────────────

export async function disableSubscription(code: string, emailToken: string): Promise<void> {
  await call('POST', '/subscription/disable', { code, token: emailToken })
}

export async function enableSubscription(code: string, emailToken: string): Promise<void> {
  await call('POST', '/subscription/enable', { code, token: emailToken })
}

export async function fetchSubscription(code: string): Promise<PaystackSubscription> {
  return call('GET', `/subscription/${encodeURIComponent(code)}`)
}

/** Hosted page where the member can update their card. */
export async function subscriptionManageLink(code: string): Promise<string> {
  const d = await call<{ link: string }>('GET', `/subscription/${encodeURIComponent(code)}/manage/link`)
  return d.link
}

/** A customer's subscriptions (used to recover a missing subscription code / email token). */
export async function customerSubscriptions(customerCode: string): Promise<PaystackSubscription[]> {
  const d = await call<{ subscriptions?: PaystackSubscription[] }>('GET', `/customer/${encodeURIComponent(customerCode)}`)
  return Array.isArray(d.subscriptions) ? d.subscriptions : []
}

// ─── Plans ─────────────────────────────────────────────────────────────────

const PLAN_ENV: Record<PaidTier, Record<BillingPeriod, string>> = {
  GOLD: { monthly: 'PAYSTACK_PLAN_GOLD_MONTHLY', annual: 'PAYSTACK_PLAN_GOLD_ANNUAL' },
  PLATINUM: { monthly: 'PAYSTACK_PLAN_PLATINUM_MONTHLY', annual: 'PAYSTACK_PLAN_PLATINUM_ANNUAL' },
}

const TIERS: PaidTier[] = ['GOLD', 'PLATINUM']
const PERIODS: BillingPeriod[] = ['monthly', 'annual']

export function paystackInterval(period: BillingPeriod): 'monthly' | 'annually' {
  return period === 'monthly' ? 'monthly' : 'annually'
}

export function planName(tier: PaidTier, period: BillingPeriod): string {
  return `${membershipItemName(tier)} (${period === 'monthly' ? 'Monthly' : 'Annual'})`
}

function envPlanCode(tier: PaidTier, period: BillingPeriod): string | null {
  const v = (process.env[PLAN_ENV[tier][period]] ?? '').trim()
  return v || null
}

/** Resolved plan codes (env or auto-created), per server process. */
const planCache = new Map<string, string>()
/** Env plan codes already checked against our price. */
const verifiedPlans = new Set<string>()
const key = (tier: PaidTier, period: BillingPeriod) => `${tier}:${period}`

function planMatches(p: PaystackPlan, tier: PaidTier, period: BillingPeriod): boolean {
  return p.amount === membershipPriceCents(tier, period)
    && (p.currency ?? PAYSTACK_CURRENCY).toUpperCase() === PAYSTACK_CURRENCY
    && p.interval === paystackInterval(period)
}

export class PlanMisconfiguredError extends Error {}

/**
 * The Paystack plan code for a membership, or null when no plan can be used
 * (checkout then charges once for the period). Env codes are checked once
 * against MEMBERSHIP_PRICES: a mismatch throws PlanMisconfiguredError so we
 * never charge a member an amount the webhook would refuse.
 */
export async function resolvePlanCode(tier: PaidTier, period: BillingPeriod): Promise<string | null> {
  const fromEnv = envPlanCode(tier, period)
  if (fromEnv) {
    if (!verifiedPlans.has(fromEnv)) {
      const p = await call<PaystackPlan>('GET', `/plan/${encodeURIComponent(fromEnv)}`)
      if (!planMatches(p, tier, period)) {
        throw new PlanMisconfiguredError(`${PLAN_ENV[tier][period]} (${fromEnv}) is ${p.amount} ${p.currency} ${p.interval}; expected ${membershipPriceCents(tier, period)} ${PAYSTACK_CURRENCY} ${paystackInterval(period)}`)
      }
      verifiedPlans.add(fromEnv)
    }
    return fromEnv
  }
  const cached = planCache.get(key(tier, period))
  if (cached) return cached
  try {
    const name = planName(tier, period)
    const existing = await call<PaystackPlan[]>('GET', `/plan?perPage=100&interval=${paystackInterval(period)}&amount=${membershipPriceCents(tier, period)}`)
    let plan = (Array.isArray(existing) ? existing : []).find((p) => p.name === name && planMatches(p, tier, period))
    if (!plan) {
      plan = await call<PaystackPlan>('POST', '/plan', {
        name,
        interval: paystackInterval(period),
        amount: membershipPriceCents(tier, period),
        currency: PAYSTACK_CURRENCY,
        description: `${name} membership on Unbound`,
      })
      console.log(`[paystack] created plan ${plan.plan_code} for ${name} — set ${PLAN_ENV[tier][period]}=${plan.plan_code} to pin it`)
    }
    planCache.set(key(tier, period), plan.plan_code)
    return plan.plan_code
  } catch (e) {
    console.error(`[paystack] couldn't find or create a plan for ${tier} ${period}; falling back to a one-off charge:`, e instanceof Error ? e.message : e)
    return null
  }
}

/** Reverse lookup: which tier/period a plan code is (env or cache). */
export function tierForPlanCode(code: string | null | undefined): { tier: PaidTier; period: BillingPeriod } | null {
  if (!code) return null
  for (const tier of TIERS) {
    for (const period of PERIODS) {
      if (envPlanCode(tier, period) === code || planCache.get(key(tier, period)) === code) return { tier, period }
    }
  }
  return null
}

/** Best-effort tier/period from a plan object's name/amount/interval. */
export function tierForPlanObject(p: PaystackPlan | null | undefined): { tier: PaidTier; period: BillingPeriod } | null {
  if (!p) return null
  for (const tier of TIERS) {
    for (const period of PERIODS) {
      if (p.amount !== undefined && p.interval && planMatches(p, tier, period)) return { tier, period }
    }
  }
  return null
}

// ─── Webhooks ──────────────────────────────────────────────────────────────

/** HMAC-SHA512 of the raw body with the secret key, compared in constant time to x-paystack-signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature.trim())) return false
  const expected = crypto.createHmac('sha512', secretKey).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
