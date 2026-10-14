import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { releaseOrder } from '@/lib/store/orders'
import { getMyOrder } from '@/lib/store/user-orders'

export const dynamic = 'force-dynamic'

/** POST → cancel one of my unpaid orders and release its items. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { number } = await params
    const order = await getMyOrder(userId, number)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'PENDING_PAYMENT') return NextResponse.json({ error: 'Only unpaid orders can be cancelled here', status: order.status }, { status: 409 })
    const ok = await releaseOrder(order.id, ['PENDING_PAYMENT'], 'CANCELLED', { note: '[member] Cancelled before paying.' })
    if (!ok) return NextResponse.json({ error: 'This order changed meanwhile — please reload' }, { status: 409 })
    return NextResponse.json({ ok: true, status: 'CANCELLED' })
  } catch (error) {
    console.error('POST /api/store/orders/[number]/cancel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
