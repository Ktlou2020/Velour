import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { maybeReleaseExpired, minutesLeftToPay } from '@/lib/store/orders'
import { getMyOrder } from '@/lib/store/user-orders'

export const dynamic = 'force-dynamic'

/** GET → { status, minutesLeft } for one of my orders (the thank-you page polls it). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await maybeReleaseExpired()
    const { number } = await params
    const order = await getMyOrder(userId, number)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    return NextResponse.json({
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      minutesLeft: order.status === 'PENDING_PAYMENT' ? minutesLeftToPay(order.createdAt) : 0,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/store/orders/[number] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
