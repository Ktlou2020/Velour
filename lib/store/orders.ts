/**
 * Orders: cart quotes, stock reservation, order creation, release of
 * abandoned orders, payment confirmation and admin status changes (server only).
 *
 * Stock is reserved when the order is created (atomic `stock >= qty`
 * decrement inside a transaction), so two buyers can never both get the last
 * unit. Every transition that gives stock back is a conditional update on the
 * order's current status, so it can only ever happen once.
 */
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE, ORDER_NUMBER_PREFIX, ORDER_NUMBER_START, RESERVATION_MINUTES, type OrderStatus } from './config'
import type { DeliveryInput } from './address'
import { thumbOf } from './catalog'
import { formatRand } from './format'
import { shippingFor } from './pricing'
import { storeSettings } from './settings'
import { alertAdmin, notifyOrder } from './notify'

export class StoreError extends Error {
  constructor(public status: number, message: string, public code = 'STORE_ERROR', public details?: Record<string, unknown>) {
    super(message)
  }
}

export const EXPIRED_NOTE = `[auto] No payment within ${RESERVATION_MINUTES} minutes — reservation released.`

export interface CartLineInput { productId: string; quantity: number }

/** Validate a cart from the client: ids + integer quantities, merged, capped. Null = malformed. */
export function normalizeCart(raw: unknown): CartLineInput[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LINES_PER_ORDER * 2) return null
  const merged = new Map<string, number>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') return null
    const { productId, quantity } = r as { productId?: unknown; quantity?: unknown }
    if (!isValidId(productId)) return null
    const q = typeof quantity === 'number' ? quantity : Number(quantity)
    if (!Number.isInteger(q) || q < 1 || q > 1000) return null
    merged.set(productId, Math.min(MAX_QTY_PER_LINE, (merged.get(productId) ?? 0) + q))
  }
  if (merged.size > MAX_LINES_PER_ORDER) return null
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }))
}

export interface QuoteLine {
  productId: string
  slug: string
  name: string
  image: string | null
  priceCents: number
  compareAtCents: number | null
  requested: number
  quantity: number // clamped to stock
  stock: number
  available: boolean
  lineCents: number
}

export interface Quote {
  lines: QuoteLine[]
  /** Product ids from the cart that no longer exist or aren't for sale. */
  missing: string[]
  subtotalCents: number
  shippingCents: number
  totalCents: number
  /** True when anything had to change (price is always the server's, quantities clamped, items removed). */
  adjusted: boolean
}

/** Price a cart from the database — the client's prices are never used. */
export async function quoteCart(cart: CartLineInput[]): Promise<Quote> {
  const products = cart.length
    ? await db.product.findMany({
        where: { id: { in: cart.map((c) => c.productId) }, isActive: true },
        select: { id: true, slug: true, name: true, images: true, priceCents: true, compareAtCents: true, stock: true },
      })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))
  const lines: QuoteLine[] = []
  const missing: string[] = []
  let adjusted = false
  for (const c of cart) {
    const p = byId.get(c.productId)
    if (!p) { missing.push(c.productId); adjusted = true; continue }
    const quantity = Math.max(0, Math.min(c.quantity, p.stock, MAX_QTY_PER_LINE))
    if (quantity !== c.quantity) adjusted = true
    lines.push({
      productId: p.id, slug: p.slug, name: p.name, image: thumbOf(p.images[0]),
      priceCents: p.priceCents, compareAtCents: p.compareAtCents && p.compareAtCents > p.priceCents ? p.compareAtCents : null,
      requested: c.quantity, quantity, stock: p.stock, available: p.stock > 0, lineCents: p.priceCents * quantity,
    })
  }
  const subtotalCents = lines.reduce((s, l) => s + l.lineCents, 0)
  const shippingCents = shippingFor(subtotalCents, storeSettings())
  return { lines, missing, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, adjusted }
}

function newPaymentRef(): string {
  return `${ORDER_NUMBER_PREFIX}${crypto.randomBytes(12).toString('hex')}`
}

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `${ORDER_NUMBER_PREFIX}-`
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("number" FROM ${prefix.length + 1}::int) AS INTEGER)) AS max
    FROM "Order" WHERE "number" ~ ${`^${ORDER_NUMBER_PREFIX}-[0-9]{1,9}$`}`
  const max = rows[0]?.max ?? null
  return `${prefix}${Math.max(ORDER_NUMBER_START, (max ?? ORDER_NUMBER_START - 1) + 1)}`
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * Reserve stock and create a PENDING_PAYMENT order. Prices come from the
 * database inside the transaction. Throws StoreError(409) when something
 * sold out meanwhile.
 */
export async function createOrder(userId: string, cart: CartLineInput[], delivery: DeliveryInput) {
  if (!cart.length) throw new StoreError(400, 'Your cart is empty', 'EMPTY_CART')

  // One open checkout per member: release any earlier unpaid order first.
  const previous = await db.order.findMany({ where: { userId, status: 'PENDING_PAYMENT' }, select: { id: true } })
  for (const p of previous) await releaseOrder(p.id, ['PENDING_PAYMENT'], 'CANCELLED', { note: '[auto] Replaced by a newer checkout.' })

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // Lock rows in a fixed order so concurrent multi-item checkouts can't deadlock.
        const sorted = [...cart].sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0))
        for (const line of sorted) {
          const r = await tx.product.updateMany({
            where: { id: line.productId, isActive: true, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          })
          if (r.count !== 1) {
            const p = await tx.product.findUnique({ where: { id: line.productId }, select: { name: true, stock: true, isActive: true } })
            throw new StoreError(409,
              !p || !p.isActive ? 'An item in your cart is no longer available'
                : p.stock <= 0 ? `${p.name} just sold out`
                  : `Only ${p.stock} × ${p.name} left`,
              'OUT_OF_STOCK', { productId: line.productId, stock: p?.isActive ? p.stock : 0 })
          }
        }
        // Rows are locked by the updates above, so these prices are current.
        const products = await tx.product.findMany({
          where: { id: { in: cart.map((c) => c.productId) } },
          select: { id: true, name: true, priceCents: true, images: true },
        })
        const byId = new Map(products.map((p) => [p.id, p]))
        const items = cart.map((c) => {
          const p = byId.get(c.productId)!
          return { productId: p.id, name: p.name, priceCents: p.priceCents, quantity: c.quantity, image: p.images[0] ?? null }
        })
        const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0)
        const shippingCents = shippingFor(subtotalCents, storeSettings())
        const number = await nextOrderNumber(tx)
        return tx.order.create({
          data: {
            number,
            userId,
            status: 'PENDING_PAYMENT',
            subtotalCents,
            shippingCents,
            totalCents: subtotalCents + shippingCents,
            recipientName: delivery.recipientName,
            phone: delivery.phone,
            email: delivery.email,
            addressLine1: delivery.addressLine1,
            addressLine2: delivery.addressLine2 || null,
            suburb: delivery.suburb || null,
            city: delivery.city,
            province: delivery.province,
            postalCode: delivery.postalCode,
            deliveryNotes: delivery.deliveryNotes || null,
            discreetPackaging: delivery.discreetPackaging,
            paymentRef: newPaymentRef(),
            items: { create: items },
          },
          include: { items: true },
        })
      }, { timeout: 15_000 })
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue // order number taken by a concurrent checkout — retry
      throw e
    }
  }
  throw new StoreError(503, 'Checkout is busy — please try again')
}

function appendNote(existing: string | null, note: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return [existing?.trim(), `${stamp} ${note}`].filter(Boolean).join('\n').slice(-4000)
}

/**
 * Move an order from one of `from` to `to`, optionally putting its items back
 * in stock. Atomic: returns false (and changes nothing) when the order wasn't
 * in one of `from` any more, so stock is never returned twice.
 */
export async function releaseOrder(
  orderId: string,
  from: OrderStatus[],
  to: 'CANCELLED' | 'REFUNDED',
  opts: { note?: string; restock?: boolean } = {},
): Promise<boolean> {
  const restock = opts.restock ?? true
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { adminNotes: true, items: { select: { productId: true, quantity: true } } } })
    if (!order) return false
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { in: from } },
      data: {
        status: to,
        ...(to === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        ...(opts.note ? { adminNotes: appendNote(order.adminNotes, opts.note) } : {}),
      },
    })
    if (claimed.count !== 1) return false
    if (restock) {
      for (const it of order.items) {
        if (!it.productId) continue
        await tx.product.updateMany({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } })
      }
    }
    return true
  })
}

export function reservationCutoff(now = Date.now()): Date {
  return new Date(now - RESERVATION_MINUTES * 60 * 1000)
}

/** Minutes left to pay a pending order (0 = expired). */
export function minutesLeftToPay(createdAt: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((createdAt.getTime() + RESERVATION_MINUTES * 60 * 1000 - now) / 60000))
}

/** Cancel unpaid orders older than the reservation window and return their stock. */
export async function releaseExpiredOrders(limit = 200): Promise<{ released: number; numbers: string[] }> {
  const stale = await db.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: reservationCutoff() } },
    select: { id: true, number: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const numbers: string[] = []
  for (const o of stale) {
    if (await releaseOrder(o.id, ['PENDING_PAYMENT'], 'CANCELLED', { note: EXPIRED_NOTE })) {
      numbers.push(o.number)
      await notifyOrder(o.id, 'EXPIRED', { email: false })
    }
  }
  return { released: numbers.length, numbers }
}

let lastLazyRelease = 0
/** Cheap lazy cleanup for page loads: at most once a minute per server process. */
export async function maybeReleaseExpired(): Promise<void> {
  const now = Date.now()
  if (now - lastLazyRelease < 60_000) return
  lastLazyRelease = now
  try {
    await releaseExpiredOrders(50)
  } catch (e) {
    console.error('[store] lazy release failed:', e instanceof Error ? e.message : e)
  }
}

export type PaymentOutcome =
  | 'paid' | 'duplicate' | 'amount_mismatch' | 'late_unfulfillable' | 'ignored' | 'cancelled'

/**
 * Apply a verified payment notification (PayFast ITN or a verified Paystack
 * charge) to a store order. Idempotent on the provider payment id, which is
 * stored in Order.pfPaymentId (Paystack ids are prefixed "paystack:").
 */
export async function applyStorePayment(
  order: { id: string; number: string; status: string; totalCents: number; pfPaymentId: string | null; adminNotes: string | null },
  itn: { paymentStatus: string; pfPaymentId: string; amountGrossCents: number | null; provider?: 'PayFast' | 'Paystack' },
): Promise<PaymentOutcome> {
  const via = itn.provider ?? 'PayFast'
  const pfId = itn.pfPaymentId.slice(0, 100)
  if (pfId && order.pfPaymentId === pfId && itn.paymentStatus === 'COMPLETE') return 'duplicate'

  if (itn.paymentStatus === 'COMPLETE') {
    if (!pfId) return 'ignored'
    if (itn.amountGrossCents === null || Math.abs(itn.amountGrossCents - order.totalCents) > 1) {
      await db.order.update({
        where: { id: order.id },
        data: { adminNotes: appendNote(order.adminNotes, `[auto] ${via} payment ${pfId} amount ${itn.amountGrossCents === null ? '?' : formatRand(itn.amountGrossCents)} does not match order total ${formatRand(order.totalCents)} — NOT marked paid.`) },
      })
      await alertAdmin(`Payment amount mismatch on ${order.number}`, `${via} payment ${pfId} reported ${itn.amountGrossCents ?? '?'} cents for order ${order.number} (total ${order.totalCents} cents). The order was not marked as paid.`)
      return 'amount_mismatch'
    }
    // A different order already carries this PayFast id → replay against the wrong order.
    const other = await db.order.findUnique({ where: { pfPaymentId: pfId }, select: { id: true } })
    if (other && other.id !== order.id) return 'ignored'

    if (order.status === 'PENDING_PAYMENT') {
      const r = await db.order.updateMany({
        where: { id: order.id, status: 'PENDING_PAYMENT', pfPaymentId: null },
        data: { status: 'PAID', paidAt: new Date(), pfPaymentId: pfId },
      })
      if (r.count === 1) {
        await notifyOrder(order.id, 'PAID')
        return 'paid'
      }
      return 'duplicate'
    }

    if (order.status === 'CANCELLED' && !order.pfPaymentId && (order.adminNotes ?? '').includes(EXPIRED_NOTE)) {
      // Paid just after the reservation lapsed: take the stock again if it's still there.
      const revived = await db.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: 'CANCELLED', pfPaymentId: null },
          data: { status: 'PAID', paidAt: new Date(), pfPaymentId: pfId, cancelledAt: null },
        })
        if (claimed.count !== 1) return false
        const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { productId: true, quantity: true } })
        for (const it of items) {
          if (!it.productId) throw new StoreError(409, 'gone')
          const u = await tx.product.updateMany({ where: { id: it.productId, stock: { gte: it.quantity } }, data: { stock: { decrement: it.quantity } } })
          if (u.count !== 1) throw new StoreError(409, 'gone')
        }
        return true
      }).catch((e) => { if (e instanceof StoreError) return false; throw e })
      if (revived) {
        await notifyOrder(order.id, 'PAID')
        return 'paid'
      }
      await db.order.updateMany({
        where: { id: order.id, pfPaymentId: null },
        data: { pfPaymentId: pfId, adminNotes: appendNote(order.adminNotes, `[auto] ${via} payment ${pfId} arrived after the reservation expired and the stock is gone — refund it in the ${via} dashboard, then mark Refunded.`) },
      })
      await alertAdmin(`Late payment on ${order.number} needs a refund`, `${via} payment ${pfId} for ${order.number} arrived after the reservation expired and the items are no longer in stock. Refund it in the ${via} dashboard.`)
      return 'late_unfulfillable'
    }
    return 'ignored'
  }

  if (itn.paymentStatus === 'FAILED' || itn.paymentStatus === 'CANCELLED') {
    if (order.status !== 'PENDING_PAYMENT') return 'ignored'
    const ok = await releaseOrder(order.id, ['PENDING_PAYMENT'], 'CANCELLED', { note: `[auto] ${via} reported ${itn.paymentStatus}${pfId ? ` (${pfId})` : ''}.` })
    if (ok) await notifyOrder(order.id, 'CANCELLED', { email: false })
    return ok ? 'cancelled' : 'ignored'
  }
  return 'ignored'
}

// ─── Admin status changes ──────────────────────────────────────────────────

export type AdminAction = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

/** Allowed admin transitions: from → actions. */
export const ADMIN_TRANSITIONS: Record<OrderStatus, AdminAction[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'], // only when a payment was received (see allowedActions)
  REFUNDED: [],
}

/** Actions an admin may take on this order right now. */
export function allowedActions(order: { status: string; pfPaymentId: string | null }): AdminAction[] {
  const list = ADMIN_TRANSITIONS[order.status as OrderStatus] ?? []
  return order.status === 'CANCELLED' && !order.pfPaymentId ? [] : list
}

/** Statuses whose items haven't left the building (refund/cancel puts them back in stock). */
const UNSHIPPED: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PROCESSING']

export async function adminSetStatus(orderId: string, action: AdminAction, opts: { courier?: string; trackingNumber?: string; note?: string }) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, adminNotes: true, pfPaymentId: true } })
  if (!order) throw new StoreError(404, 'Order not found')
  const from = order.status as OrderStatus
  if (!allowedActions(order).includes(action)) throw new StoreError(409, `Can't mark a ${from.toLowerCase().replace('_', ' ')} order as ${action.toLowerCase()}`)

  if (action === 'CANCELLED' || action === 'REFUNDED') {
    // A cancelled order's stock was already returned when it was cancelled.
    const restock = UNSHIPPED.includes(from)
    // Claim from the status we just read, so the restock decision can't go stale.
    const ok = await releaseOrder(order.id, [from], action, {
      restock,
      note: `[admin] Marked ${action.toLowerCase()}${restock ? ' — items returned to stock' : ''}${opts.note ? `: ${opts.note}` : ''}.`,
    })
    if (!ok) throw new StoreError(409, 'The order changed meanwhile — reload and try again')
    // Unpaid orders cancelled by an admin: in-app notice only (nothing was charged)
    await notifyOrder(order.id, action, { email: !(action === 'CANCELLED' && from === 'PENDING_PAYMENT') })
    return
  }

  const data: Prisma.OrderUpdateManyMutationInput = { status: action }
  if (action === 'SHIPPED') {
    const courier = (opts.courier ?? '').trim().slice(0, 60)
    const tracking = (opts.trackingNumber ?? '').trim().slice(0, 300)
    if (!courier || !tracking) throw new StoreError(400, 'Courier and tracking number are required to mark an order shipped')
    if (/^https?:\/\//i.test(tracking) && !/^https:\/\/[^\s<>"']+$/i.test(tracking)) throw new StoreError(400, 'Tracking links must start with https://')
    data.courier = courier
    data.trackingNumber = tracking
    data.shippedAt = new Date()
  }
  if (action === 'DELIVERED') data.deliveredAt = new Date()
  if (opts.note) data.adminNotes = appendNote(order.adminNotes, `[admin] ${opts.note}`)

  const r = await db.order.updateMany({ where: { id: order.id, status: from }, data })
  if (r.count !== 1) throw new StoreError(409, 'The order changed meanwhile — reload and try again')
  if (action === 'SHIPPED') await notifyOrder(order.id, 'SHIPPED')
  if (action === 'DELIVERED') await notifyOrder(order.id, 'DELIVERED')
}
