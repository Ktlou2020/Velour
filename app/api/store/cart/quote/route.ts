import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { normalizeCart, quoteCart } from '@/lib/store/orders'

export const dynamic = 'force-dynamic'

/** POST { items: [{ productId, quantity }] } → current prices, stock and totals from the database. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => null) as { items?: unknown } | null
    const cart = normalizeCart(body?.items ?? [])
    if (!cart) return NextResponse.json({ error: 'Invalid cart' }, { status: 400 })
    return NextResponse.json(await quoteCart(cart))
  } catch (error) {
    console.error('POST /api/store/cart/quote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
