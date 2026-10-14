import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { plainText } from '@/lib/store/format'
import { StoreError, adminSetStatus, allowedActions, type AdminAction } from '@/lib/store/orders'

export const dynamic = 'force-dynamic'

const ACTIONS: AdminAction[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: { select: { id: true, name: true, priceCents: true, quantity: true, image: true, productId: true, product: { select: { slug: true, sku: true, stock: true } } } },
        user: { select: { id: true, username: true, email: true } },
      },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ order, actions: allowedActions(order) })
  } catch (error) {
    console.error('GET /api/admin/store/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH { action: PROCESSING|SHIPPED|DELIVERED|CANCELLED|REFUNDED, courier?, trackingNumber?, note? }
 * PATCH { adminNotes } → replace the internal notes.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    if (typeof body.adminNotes === 'string' && body.action === undefined) {
      const r = await db.order.updateMany({ where: { id }, data: { adminNotes: plainText(body.adminNotes, 4000) || null } })
      if (!r.count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }
    const action = body.action as AdminAction
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    await adminSetStatus(id, action, {
      courier: typeof body.courier === 'string' ? body.courier : undefined,
      trackingNumber: typeof body.trackingNumber === 'string' ? body.trackingNumber : undefined,
      note: typeof body.note === 'string' ? plainText(body.note, 300) : undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('PATCH /api/admin/store/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
