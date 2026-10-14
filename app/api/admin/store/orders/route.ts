import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { ORDER_STATUSES } from '@/lib/store/config'
import { maybeReleaseExpired } from '@/lib/store/orders'

export const dynamic = 'force-dynamic'

/** GET ?status=&q= → orders + 30-day summary. */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await maybeReleaseExpired()
    const status = req.nextUrl.searchParams.get('status') ?? ''
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80)
    const where: Prisma.OrderWhereInput = {}
    if ((ORDER_STATUSES as readonly string[]).includes(status)) where.status = status
    else if (status === 'OPEN') where.status = { in: ['PAID', 'PROCESSING'] }
    if (q) where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { recipientName: { contains: q, mode: 'insensitive' } },
      { user: { username: { contains: q, mode: 'insensitive' } } },
    ]
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const paidStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']
    const [orders, paid30, counts] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, number: true, status: true, totalCents: true, recipientName: true, city: true, province: true,
          discreetPackaging: true, createdAt: true, paidAt: true, user: { select: { username: true } },
          _count: { select: { items: true } },
        },
      }),
      db.order.aggregate({ where: { status: { in: paidStatuses }, paidAt: { gte: since } }, _sum: { totalCents: true }, _count: true }),
      db.order.groupBy({ by: ['status'], _count: true }),
    ])
    return NextResponse.json({
      orders,
      summary: {
        orders30: paid30._count,
        revenue30Cents: paid30._sum.totalCents ?? 0,
        byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      },
    })
  } catch (error) {
    console.error('GET /api/admin/store/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
