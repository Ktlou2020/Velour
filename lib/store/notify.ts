/**
 * Order emails + in-app notifications (server only, best effort — never throws).
 *
 * Notification/push text is deliberately discreet: order number and status
 * only, never product names (they can show on a lock screen).
 */
import { db } from '@/lib/db'
import { escapeHtml, sendBrandedEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { COURIERS, STORE_NAME, SUPPORT_EMAIL } from './config'
import { formatRand } from './format'
import { storeSettings } from './settings'

export const STORE_NOTIFICATION_TYPE = 'STORE_ORDER'

export type OrderEvent = 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'

type OrderForNotify = {
  id: string
  number: string
  userId: string
  email: string
  recipientName: string
  totalCents: number
  subtotalCents: number
  shippingCents: number
  addressLine1: string
  addressLine2: string | null
  suburb: string | null
  city: string
  province: string
  postalCode: string
  discreetPackaging: boolean
  courier: string | null
  trackingNumber: string | null
  items: { name: string; quantity: number; priceCents: number }[]
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export function orderPath(number: string): string {
  return `/store/orders/${encodeURIComponent(number)}`
}

/** Tracking link for an order: the tracking value itself when it's a URL, else the courier's site. */
export function trackingLink(courier: string | null, tracking: string | null): string | null {
  if (tracking && /^https:\/\/[^\s]+$/i.test(tracking)) return tracking
  const c = COURIERS.find((x) => x.name === courier)
  return c?.site ?? null
}

const COPY: Record<OrderEvent, { title: (n: string) => string; body: string; subject: (n: string) => string; heading: string }> = {
  PAID: {
    title: (n) => `Order ${n} confirmed`,
    body: 'Payment received — we’re getting it ready. It ships in plain packaging.',
    subject: (n) => `Order ${n} confirmed`,
    heading: 'Order confirmed',
  },
  SHIPPED: {
    title: (n) => `Order ${n} is on its way`,
    body: 'Your parcel has shipped. Tap for tracking details.',
    subject: (n) => `Order ${n} has shipped`,
    heading: 'On its way',
  },
  DELIVERED: {
    title: (n) => `Order ${n} delivered`,
    body: 'Your parcel has been delivered. Enjoy.',
    subject: (n) => `Order ${n} delivered`,
    heading: 'Delivered',
  },
  CANCELLED: {
    title: (n) => `Order ${n} cancelled`,
    body: 'Your order was cancelled. If you were charged, the refund is on its way.',
    subject: (n) => `Order ${n} cancelled`,
    heading: 'Order cancelled',
  },
  EXPIRED: {
    title: (n) => `Order ${n} cancelled`,
    body: 'We didn’t receive payment in time, so the items were released. Your cart is still waiting.',
    subject: (n) => `Order ${n} cancelled`,
    heading: 'Order cancelled',
  },
  REFUNDED: {
    title: (n) => `Order ${n} refunded`,
    body: 'Your refund has been processed. It can take a few working days to reflect.',
    subject: (n) => `Order ${n} refunded`,
    heading: 'Refund processed',
  },
}

function itemsTable(o: OrderForNotify): string {
  const rows = o.items.map((i) => `
    <tr>
      <td style="padding:6px 0;color:#d0d0d8;font-size:14px;">${escapeHtml(i.name)} × ${i.quantity}</td>
      <td style="padding:6px 0;color:#d0d0d8;font-size:14px;text-align:right;">${escapeHtml(formatRand(i.priceCents * i.quantity))}</td>
    </tr>`).join('')
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);">
    ${rows}
    <tr><td style="padding:6px 0;color:#888899;font-size:13px;">Delivery</td><td style="padding:6px 0;color:#888899;font-size:13px;text-align:right;">${o.shippingCents ? escapeHtml(formatRand(o.shippingCents)) : 'Free'}</td></tr>
    <tr><td style="padding:8px 0;color:#ffffff;font-size:15px;font-weight:bold;">Total (incl. VAT)</td><td style="padding:8px 0;color:#ffffff;font-size:15px;font-weight:bold;text-align:right;">${escapeHtml(formatRand(o.totalCents))}</td></tr>
  </table>`
}

function addressBlock(o: OrderForNotify): string {
  const lines = [o.recipientName, o.addressLine1, o.addressLine2, o.suburb, `${o.city}, ${o.postalCode}`, o.province].filter(Boolean) as string[]
  return `<p style="color:#b0b0bb;font-size:13px;line-height:1.6;margin:0 0 16px;">${lines.map(escapeHtml).join('<br />')}</p>`
}

function emailBody(o: OrderForNotify, ev: OrderEvent): string {
  const link = `${appUrl()}${orderPath(o.number)}`
  const greet = `<p style="color:#ffffff;font-size:16px;margin:0 0 12px;">Hi ${escapeHtml(o.recipientName.split(' ')[0] || 'there')},</p>`
  const button = `<p style="margin:24px 0 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;font-size:14px;">View order ${escapeHtml(o.number)}</a></p>`
  const s = storeSettings()
  const discreet = o.discreetPackaging
    ? `<p style="color:#888899;font-size:13px;margin:0 0 8px;">Discreet delivery: plain packaging, sender shown as “${escapeHtml(s.discreetSender)}”.</p>`
    : ''
  const footer = `<p style="color:#666677;font-size:12px;margin:24px 0 0;">Questions? Reply to <a href="mailto:${SUPPORT_EMAIL}" style="color:#DC143C;">${SUPPORT_EMAIL}</a> and quote ${escapeHtml(o.number)}.</p>`

  switch (ev) {
    case 'PAID':
      return `${greet}<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0;">Thank you — we’ve received your payment for order <strong>${escapeHtml(o.number)}</strong> from ${escapeHtml(STORE_NAME)}. We’ll let you know when it ships.</p>
        ${itemsTable(o)}
        <p style="color:#ffffff;font-size:13px;font-weight:bold;margin:0 0 4px;">Delivering to</p>${addressBlock(o)}${discreet}${button}${footer}`
    case 'SHIPPED': {
      const track = trackingLink(o.courier, o.trackingNumber)
      const trackingIsUrl = !!o.trackingNumber && /^https:\/\//i.test(o.trackingNumber)
      return `${greet}<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0 0 12px;">Order <strong>${escapeHtml(o.number)}</strong> is on its way.</p>
        <p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0;">Courier: <strong>${escapeHtml(o.courier ?? '—')}</strong><br />
        ${trackingIsUrl ? '' : `Tracking number: <strong>${escapeHtml(o.trackingNumber ?? '—')}</strong><br />`}
        ${track ? `<a href="${escapeHtml(track)}" style="color:#DC143C;">Track your parcel</a>` : ''}</p>
        ${discreet ? `<div style="margin-top:12px;">${discreet}</div>` : ''}${button}${footer}`
    }
    case 'DELIVERED':
      return `${greet}<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0;">Order <strong>${escapeHtml(o.number)}</strong> has been delivered. If anything isn’t right, let us know within 6 months for defective goods.</p>${button}${footer}`
    case 'CANCELLED':
      return `${greet}<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0;">Order <strong>${escapeHtml(o.number)}</strong> has been cancelled. If a payment went through, it will be refunded to your original payment method.</p>${button}${footer}`
    case 'EXPIRED':
      return `${greet}<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0;">We didn’t receive payment for order <strong>${escapeHtml(o.number)}</strong> in time, so it was cancelled and the items released. You haven’t been charged.</p>${button}${footer}`
    case 'REFUNDED':
      return `${greet}<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0;">We’ve refunded order <strong>${escapeHtml(o.number)}</strong> (${escapeHtml(formatRand(o.totalCents))}). Depending on your bank it can take a few working days to reflect.</p>${button}${footer}`
  }
}

/** Email + notification + push for an order status change. */
export async function notifyOrder(orderId: string, ev: OrderEvent, opts: { email?: boolean } = {}): Promise<void> {
  try {
    const o = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, number: true, userId: true, email: true, recipientName: true, totalCents: true, subtotalCents: true, shippingCents: true,
        addressLine1: true, addressLine2: true, suburb: true, city: true, province: true, postalCode: true, discreetPackaging: true,
        courier: true, trackingNumber: true, items: { select: { name: true, quantity: true, priceCents: true } },
      },
    })
    if (!o) return
    const copy = COPY[ev]
    const url = orderPath(o.number)
    const tasks: Promise<unknown>[] = [
      db.notification.create({
        data: { userId: o.userId, type: STORE_NOTIFICATION_TYPE, title: copy.title(o.number), body: copy.body, data: { url, number: o.number, status: ev } },
      }),
      sendPushToUser(o.userId, { title: copy.title(o.number), body: copy.body, url, tag: `store:${o.number}` }),
    ]
    if (opts.email !== false) {
      tasks.push(sendBrandedEmail(o.email, copy.subject(o.number), copy.heading, emailBody(o, ev)))
    }
    const results = await Promise.allSettled(tasks)
    for (const r of results) if (r.status === 'rejected') console.error('[store] notify failed:', r.reason instanceof Error ? r.reason.message : r.reason)

    const adminEmail = (process.env.STORE_ADMIN_EMAIL ?? '').trim()
    if (ev === 'PAID' && adminEmail) {
      await sendBrandedEmail(adminEmail, `New paid order ${o.number}`, 'New order',
        `<p style="color:#d0d0d8;font-size:14px;">Order <strong>${escapeHtml(o.number)}</strong> was paid (${escapeHtml(formatRand(o.totalCents))}).</p>
         <p><a href="${escapeHtml(appUrl())}/admin/store/orders?open=${encodeURIComponent(o.id)}" style="color:#DC143C;">Open in admin</a></p>`).catch(() => {})
    }
  } catch (e) {
    console.error('[store] notifyOrder error:', e instanceof Error ? e.message : e)
  }
}

/** Alert the shop owner about something that needs a human (best effort). */
export async function alertAdmin(subject: string, text: string): Promise<void> {
  console.warn(`[store] ADMIN ALERT: ${subject} — ${text}`)
  const adminEmail = (process.env.STORE_ADMIN_EMAIL ?? '').trim()
  if (!adminEmail) return
  await sendBrandedEmail(adminEmail, subject, 'Store alert', `<p style="color:#d0d0d8;font-size:14px;">${escapeHtml(text)}</p>`).catch(() => {})
}
