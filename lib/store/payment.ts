/** PayFast form for a store order (server only). */
import { buildCheckoutFields, centsToAmount, payfastText, type PayfastConfig } from '@/lib/payfast'
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
