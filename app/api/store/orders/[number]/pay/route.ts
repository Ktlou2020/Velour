import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PAYMENTS_NOT_CONFIGURED, payfastConfig } from '@/lib/payfast'
import { minutesLeftToPay } from '@/lib/store/orders'
import { orderPaymentForm } from '@/lib/store/payment'
import { getMyOrder } from '@/lib/store/user-orders'

export const dynamic = 'force-dynamic'

/** POST → a fresh signed PayFast form for one of my unpaid orders (within the reservation window). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const cfg = payfastConfig()
    if (!cfg) return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED, code: 'PAYMENTS_DISABLED' }, { status: 503 })
    const { number } = await params
    const order = await getMyOrder(userId, number)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'PENDING_PAYMENT') return NextResponse.json({ error: 'This order no longer needs payment', status: order.status }, { status: 409 })
    if (minutesLeftToPay(order.createdAt) <= 0) {
      return NextResponse.json({ error: 'This order’s reservation has expired — please check out again', code: 'EXPIRED' }, { status: 409 })
    }
    return NextResponse.json({ payfast: orderPaymentForm(order, cfg) })
  } catch (error) {
    console.error('POST /api/store/orders/[number]/pay error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
