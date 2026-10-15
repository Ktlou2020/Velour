/**
 * PayFast helpers (server only) — shared by membership checkout, the store
 * checkout and the ITN (notify) handler.
 *
 * Signatures follow PayFast's documented algorithm:
 *   - checkout: the non-empty fields IN PAYFAST'S DOCUMENTED ORDER (not
 *     alphabetical), values trimmed and encoded like PHP `urlencode`
 *     (spaces → '+', uppercase hex, `!'()*~` encoded too), joined with '&',
 *     then `&passphrase=<urlencoded passphrase>` when a passphrase is set,
 *     then md5 (lower-case hex).
 *   - ITN: the received fields IN THE ORDER RECEIVED, excluding `signature`,
 *     same encoding + passphrase, md5.
 *
 * Env:
 *   PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY   required to take payments
 *   PAYFAST_PASSPHRASE                          strongly recommended (required for subscriptions)
 *   PAYFAST_SANDBOX=true                        use sandbox.payfast.co.za
 *   PAYFAST_SKIP_VALIDATE=true                  skip the server-to-server ITN check (local tests only)
 */
import crypto from 'crypto'

export interface PayfastConfig {
  merchantId: string
  merchantKey: string
  passphrase: string | null
  sandbox: boolean
  host: string
  processUrl: string
  validateUrl: string
}

/** Current PayFast configuration, or null when payments aren't set up. */
export function payfastConfig(): PayfastConfig | null {
  const merchantId = (process.env.PAYFAST_MERCHANT_ID ?? '').trim()
  const merchantKey = (process.env.PAYFAST_MERCHANT_KEY ?? '').trim()
  if (!merchantId || !merchantKey) return null
  const passphrase = (process.env.PAYFAST_PASSPHRASE ?? '').trim() || null
  const sandbox = (process.env.PAYFAST_SANDBOX ?? '').trim().toLowerCase() === 'true'
  const host = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'
  return {
    merchantId,
    merchantKey,
    passphrase,
    sandbox,
    host,
    processUrl: `https://${host}/eng/process`,
    validateUrl: `https://${host}/eng/query/validate`,
  }
}

export const PAYMENTS_NOT_CONFIGURED = "Payments aren't set up yet. Please try again later."

/**
 * Field order from PayFast's "Custom integration" attribute list. The
 * checkout signature MUST be built in this order.
 */
export const PAYFAST_FIELD_ORDER = [
  // Merchant details
  'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url', 'notify_method',
  // Customer details
  'name_first', 'name_last', 'email_address', 'cell_number',
  // Transaction details
  'm_payment_id', 'amount', 'item_name', 'item_description',
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  // Transaction options
  'email_confirmation', 'confirmation_address',
  // Payment methods
  'payment_method',
  // Recurring billing
  'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles',
  'subscription_notify_email', 'subscription_notify_webhook', 'subscription_notify_buyer',
] as const

export type PayfastField = (typeof PAYFAST_FIELD_ORDER)[number]

/** PHP `urlencode()`: RFC 3986 unreserved stay as-is except `~`; space → '+'; uppercase hex. */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+')
}

/** md5 of `pairs` (already in the right order) + optional passphrase. */
export function signPairs(pairs: [string, string][], passphrase: string | null, encode: (v: string) => string = phpUrlencode): string {
  return crypto.createHash('md5').update(signatureBase(pairs, passphrase, encode)).digest('hex')
}

/** The exact string that gets md5'd (exported for tests / debugging). */
export function signatureBase(pairs: [string, string][], passphrase: string | null, encode: (v: string) => string = phpUrlencode): string {
  let s = pairs.map(([k, v]) => `${k}=${encode(v)}`).join('&')
  if (passphrase) s += `${s ? '&' : ''}passphrase=${encode(passphrase)}`
  return s
}

/**
 * Order + clean checkout fields and sign them. Values are trimmed; empty
 * values are dropped (PayFast ignores them and excludes them from the
 * signature). Unknown keys are rejected so nothing unsigned is ever posted.
 * Returns the ordered [name, value] list with `signature` last.
 */
export function buildCheckoutFields(fields: Partial<Record<PayfastField, string | number | null | undefined>>, passphrase: string | null): [string, string][] {
  for (const k of Object.keys(fields)) {
    if (!(PAYFAST_FIELD_ORDER as readonly string[]).includes(k)) throw new Error(`Unknown PayFast field: ${k}`)
  }
  const pairs: [string, string][] = []
  for (const key of PAYFAST_FIELD_ORDER) {
    const raw = fields[key]
    if (raw === null || raw === undefined) continue
    const value = String(raw).trim()
    if (value === '') continue
    pairs.push([key, value])
  }
  pairs.push(['signature', signPairs(pairs, passphrase)])
  return pairs
}

/** Rand amount string PayFast expects ("1299.00") from integer cents. */
export function centsToAmount(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2)
}

/** Parse an amount like "1299.00" to cents (NaN-safe → null). */
export function amountToCents(amount: string | undefined | null): number | null {
  if (!amount || !/^-?\d+(\.\d{1,2})?$/.test(amount.trim())) return null
  return Math.round(Number(amount.trim()) * 100)
}

/** Keep only characters that encode identically everywhere (PayFast item_name / description). */
export function payfastText(s: string, max = 100): string {
  return s.replace(/[^A-Za-z0-9 .,:#\-_/&+]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// ─── ITN ────────────────────────────────────────────────────────────────────

/** Parse an x-www-form-urlencoded body keeping the order PayFast sent the fields in. */
export function parseItnBody(body: string): [string, string][] {
  const out: [string, string][] = []
  if (!body) return out
  for (const part of body.split('&')) {
    if (!part) continue
    const i = part.indexOf('=')
    const rawKey = i === -1 ? part : part.slice(0, i)
    const rawVal = i === -1 ? '' : part.slice(i + 1)
    const dec = (x: string) => {
      try { return decodeURIComponent(x.replace(/\+/g, ' ')) } catch { return x }
    }
    out.push([dec(rawKey), dec(rawVal)])
  }
  return out
}

function nodeExampleEncode(v: string): string {
  // PayFast's own Node.js sample: encodeURIComponent with %20 → '+'
  return encodeURIComponent(v).replace(/%20/g, '+')
}

/**
 * Verify an ITN signature. The documented algorithm (PHP sample) signs every
 * received field except `signature`, in order, including blank ones. We also
 * accept the variants PayFast's other samples produce (blanks dropped, or
 * JavaScript-style encoding) — every variant still requires the passphrase.
 */
export function verifyItnSignature(pairs: [string, string][], passphrase: string | null): boolean {
  const received = pairs.find(([k]) => k === 'signature')?.[1]?.trim().toLowerCase()
  if (!received || !/^[a-f0-9]{32}$/.test(received)) return false
  const fields = pairs.filter(([k]) => k !== 'signature').map(([k, v]) => [k, v.trim()] as [string, string])
  const nonEmpty = fields.filter(([, v]) => v !== '')
  const candidates = [
    signPairs(fields, passphrase),
    signPairs(nonEmpty, passphrase),
    signPairs(fields, passphrase, nodeExampleEncode),
    signPairs(nonEmpty, passphrase, nodeExampleEncode),
  ]
  const r = Buffer.from(received)
  return candidates.some((c) => {
    const b = Buffer.from(c)
    return b.length === r.length && crypto.timingSafeEqual(b, r)
  })
}

/** Param string PayFast's validate endpoint expects: received order, minus signature, no passphrase. */
export function itnParamString(pairs: [string, string][]): string {
  return pairs.filter(([k]) => k !== 'signature').map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`).join('&')
}

export type ValidateResult = 'VALID' | 'INVALID' | 'ERROR'

/**
 * Server-to-server confirmation: POST the received data back to PayFast,
 * which answers "VALID" for genuine notifications. 'ERROR' = network/HTTP
 * problem (respond non-200 so PayFast retries).
 */
export async function validateWithPayfast(pairs: [string, string][], cfg: PayfastConfig): Promise<ValidateResult> {
  if ((process.env.PAYFAST_SKIP_VALIDATE ?? '').trim().toLowerCase() === 'true') {
    if (process.env.NODE_ENV === 'production' && !cfg.sandbox) {
      console.warn('[payfast] PAYFAST_SKIP_VALIDATE is ignored for live (non-sandbox) payments')
    } else {
      return 'VALID'
    }
  }
  try {
    const res = await fetch(cfg.validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: itnParamString(pairs),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!res.ok) return 'ERROR'
    const text = (await res.text()).trim()
    return text === 'VALID' ? 'VALID' : 'INVALID'
  } catch (e) {
    console.error('[payfast] validate request failed:', e instanceof Error ? e.message : e)
    return 'ERROR'
  }
}

// ─── Membership plans ──────────────────────────────────────────────────────

/** Membership prices in rand (VAT-inclusive). Used by checkout and to check ITN amounts. */
export const MEMBERSHIP_PRICES: Record<'GOLD' | 'PLATINUM', Record<'monthly' | 'annual', number>> = {
  GOLD: {
    monthly: 199.0,
    annual: 1668.0, // 139/mo
  },
  PLATINUM: {
    monthly: 349.0,
    annual: 2988.0, // 249/mo
  },
}

export function membershipItemName(tier: 'GOLD' | 'PLATINUM'): string {
  return tier === 'GOLD' ? 'Unbound Gold' : 'Unbound Platinum'
}

// ─── Subscriptions API (cancel) ─────────────────────────────────────────────

/** ISO-8601 timestamp in SAST, as PayFast's API expects (e.g. 2026-10-15T14:05:00+02:00). */
function payfastTimestamp(now = new Date()): string {
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return `${sast.toISOString().slice(0, 19)}+02:00`
}

/**
 * Header signature for api.payfast.co.za: every header + body param plus
 * `passphrase`, sorted alphabetically by key, `key=urlencode(value)` joined
 * with '&', md5.
 */
export function payfastApiSignature(params: Record<string, string>, passphrase: string): string {
  const all: Record<string, string> = { ...params, passphrase }
  const base = Object.keys(all).sort().map((k) => `${k}=${phpUrlencode(all[k].trim())}`).join('&')
  return crypto.createHash('md5').update(base).digest('hex')
}

export type PayfastCancelResult = 'cancelled' | 'failed' | 'unavailable'

/**
 * Cancel a PayFast recurring subscription by its token. 'unavailable' = no
 * passphrase configured (the API needs it), so cancel manually in the PayFast
 * dashboard. Never throws.
 */
export async function cancelPayfastSubscription(token: string): Promise<PayfastCancelResult> {
  const cfg = payfastConfig()
  if (!cfg || !cfg.passphrase) return 'unavailable'
  if (!/^[A-Za-z0-9-]{8,64}$/.test(token)) return 'failed'
  const headers = { 'merchant-id': cfg.merchantId, version: 'v1', timestamp: payfastTimestamp() }
  const signature = payfastApiSignature(headers, cfg.passphrase)
  const url = `https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/cancel${cfg.sandbox ? '?testing=true' : ''}`
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, signature, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as { code?: number; status?: string; data?: { response?: unknown; message?: string } } | null
    if (res.ok && json && (json.status === 'success' || json.code === 200)) return 'cancelled'
    console.warn(`[payfast] subscription cancel failed: HTTP ${res.status} ${String(json?.data?.message ?? json?.status ?? '').slice(0, 120)}`)
    return 'failed'
  } catch (e) {
    console.error('[payfast] subscription cancel request failed:', e instanceof Error ? e.message : e)
    return 'failed'
  }
}
