import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PAYMENTS_NOT_CONFIGURED, activePaymentProvider } from '@/lib/payments'
import { PaystackError } from '@/lib/paystack'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { validateDelivery } from '@/lib/store/address'
import { StoreError, createOrder, normalizeCart, quoteCart } from '@/lib/store/orders'
import { startOrderPayment } from '@/lib/store/payment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/store/checkout
 *   { items: [{ productId, quantity }], delivery: {...}, expectedTotalCents? }
 *
 * Prices and stock come from the database; client prices are ignored.
 * Reserves stock and creates a PENDING_PAYMENT order, then returns the
 * payment hand-off for the active provider:
 *   Paystack → { order: { number, totalCents }, provider: 'PAYSTACK', redirectUrl }
 *   PayFast  → { order: { number, totalCents }, provider: 'PAYFAST', payfast: { action, fields } }
 * 503 when no provider is configured; 409 when something sold out; 422 on bad delivery details.
 * If Paystack can't be reached the order stays reserved and can be paid from its order page.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!activePaymentProvider()) return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED, code: 'PAYMENTS_DISABLED' }, { status: 503 })

    if (!rateLimit(`store-checkout:${userId}`, 12, 10 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as { items?: unknown; delivery?: unknown; expectedTotalCents?: unknown } | null
    const cart = normalizeCart(body?.items)
    if (!cart || cart.length === 0) return NextResponse.json({ error: 'Your cart is empty', code: 'EMPTY_CART' }, { status: 400 })

    const { value: delivery, errors } = validateDelivery((body?.delivery && typeof body.delivery === 'object' ? body.delivery : {}) as Record<string, unknown>)
    if (Object.keys(errors).length) return NextResponse.json({ error: 'Please check your delivery details', code: 'INVALID_DELIVERY', fields: errors }, { status: 422 })

    // If the cart the buyer saw no longer matches the shop (prices/stock changed), show them the new totals first.
    const quote = await quoteCart(cart)
    if (quote.missing.length || quote.lines.some((l) => l.quantity !== l.requested)) {
      return NextResponse.json({ error: 'Some items changed — please review your cart', code: 'CART_CHANGED', quote }, { status: 409 })
    }
    if (typeof body?.expectedTotalCents === 'number' && body.expectedTotalCents !== quote.totalCents) {
      return NextResponse.json({ error: 'Prices have changed — please review the new total', code: 'PRICE_CHANGED', quote }, { status: 409 })
    }

    const order = await createOrder(userId, cart, delivery)
    const summary = { number: order.number, totalCents: order.totalCents }
    let start
    try {
      start = await startOrderPayment(order)
    } catch (e) {
      if (!(e instanceof PaystackError)) throw e
      console.error('POST /api/store/checkout Paystack error:', e.message)
      return NextResponse.json({ error: 'We couldn’t reach our payment provider. Your items are reserved — pay from your order page in a moment.', code: 'PROVIDER_UNAVAILABLE', order: summary }, { status: 502 })
    }
    if (!start) return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED, code: 'PAYMENTS_DISABLED' }, { status: 503 })
    return NextResponse.json({ order: summary, ...start }, { status: 201 })
  } catch (error) {
    if (error instanceof StoreError) {
      return NextResponse.json({ error: error.message, code: error.code, ...(error.details ?? {}) }, { status: error.status })
    }
    console.error('POST /api/store/checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
