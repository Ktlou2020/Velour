/** Payment hand-off for a store order: PayFast form or Paystack redirect (server only). */
import crypto from 'crypto'
import { buildCheckoutFields, centsToAmount, payfastText, type PayfastConfig } from '@/lib/payfast'
import { PaystackError, initializeTransaction } from '@/lib/paystack'
import { activePaymentProvider } from '@/lib/payments'
import { payfastConfig } from '@/lib/payfast'
import { isSaMobile } from './address'
import { STORE_NAME } from './config'

export interface PayfastForm {
  action: string
  /** Ordered [name, value] pairs, `signature` last — post them as hidden inputs in this order. */
  fields: [string, string][]
}

export const STORE_PAYMENT_MARKER = 'store'

export function orderPaymentForm(
  order: { number: string; paymentRef: string; totalCents: number; recipientName: string; email: string; phone: string; items: { quantity: number }[] },
  cfg: PayfastConfig,
): PayfastForm {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const [first, ...rest] = payfastText(order.recipientName, 100).split(' ')
  const units = order.items.reduce((s, i) => s + i.quantity, 0)
  const fields = buildCheckoutFields({
    merchant_id: cfg.merchantId,
    merchant_key: cfg.merchantKey,
    return_url: `${appUrl}/store/thank-you?order=${encodeURIComponent(order.number)}`,
    cancel_url: `${appUrl}/store/checkout?cancelled=1&order=${encodeURIComponent(order.number)}`,
    notify_url: `${appUrl}/api/payment/payfast/notify`,
    name_first: first?.slice(0, 100),
    name_last: rest.join(' ').slice(0, 100),
    email_address: order.email,
    cell_number: isSaMobile(order.phone) ? order.phone : undefined,
    m_payment_id: order.paymentRef,
    amount: centsToAmount(order.totalCents),
    // Discreet: the statement/receipt line names the order, never the products.
    item_name: payfastText(`${STORE_NAME} order ${order.number}`, 100),
    item_description: `${units} item${units === 1 ? '' : 's'}`,
    custom_str1: STORE_PAYMENT_MARKER,
    custom_str2: order.number,
  }, cfg.passphrase)
  return { action: cfg.processUrl, fields }
}

// ─── Paystack ──────────────────────────────────────────────────────────────

type PayableOrder = Parameters<typeof orderPaymentForm>[0] & { userId: string }

/**
 * Start a Paystack checkout for an order. The reference is the order's
 * paymentRef; if Paystack already has a transaction under it (the member
 * pressed "Pay now" again), a suffixed reference "<paymentRef>-<hex>" is used —
 * the webhook maps both back to the order. The amount is the server-side total.
 */
export async function paystackOrderCheckout(order: PayableOrder): Promise<{ redirectUrl: string; reference: string }> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const units = order.items.reduce((s, i) => s + i.quantity, 0)
  const base = {
    email: order.email,
    amountCents: order.totalCents,
    // Paystack appends ?trxref=…&reference=…; the order page verifies it server-side.
    callbackUrl: `${appUrl}/store/orders/${encodeURIComponent(order.number)}`,
    // Discreet: name the order, never the products.
    metadata: {
      kind: STORE_PAYMENT_MARKER,
      orderNumber: order.number,
      userId: order.userId,
      custom_fields: [{ display_name: 'Order', variable_name: 'order', value: `${STORE_NAME} order ${order.number} (${units} item${units === 1 ? '' : 's'})` }],
    },
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = attempt === 0 ? order.paymentRef : `${order.paymentRef}-${crypto.randomBytes(4).toString('hex')}`
    try {
      const r = await initializeTransaction({ ...base, reference })
      return { redirectUrl: r.authorization_url, reference: r.reference }
    } catch (e) {
      if (e instanceof PaystackError && /duplicate/i.test(e.message)) continue
      throw e
    }
  }
  throw new PaystackError('Could not start payment', null)
}

/** "<paymentRef>" or "<paymentRef>-<hex>" → paymentRef (null when it isn't a store reference). */
export function paymentRefFromReference(reference: string): string | null {
  const m = /^([A-Z]{2}[a-f0-9]{24})(?:-[a-f0-9]{8})?$/.exec(reference)
  return m ? m[1] : null
}

export type StorePaymentStart =
  | { provider: 'PAYSTACK'; redirectUrl: string }
  | { provider: 'PAYFAST'; payfast: PayfastForm }

/** Hand-off for whichever provider is active (null = payments not configured). */
export async function startOrderPayment(order: PayableOrder): Promise<StorePaymentStart | null> {
  const provider = activePaymentProvider()
  if (provider === 'PAYSTACK') {
    const { redirectUrl } = await paystackOrderCheckout(order)
    return { provider, redirectUrl }
  }
  const cfg = payfastConfig()
  if (provider === 'PAYFAST' && cfg) return { provider, payfast: orderPaymentForm(order, cfg) }
  return null
}
