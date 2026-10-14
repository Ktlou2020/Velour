import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { parseProductInput } from '@/lib/store/admin'
import { LOW_STOCK_THRESHOLD } from '@/lib/store/config'

export const dynamic = 'force-dynamic'

/** GET ?q=&filter=all|active|hidden|low|out */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80)
    const filter = req.nextUrl.searchParams.get('filter') ?? 'all'
    const where: Prisma.ProductWhereInput = {}
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { tags: { has: q.toLowerCase() } }]
    if (filter === 'active') where.isActive = true
    if (filter === 'hidden') where.isActive = false
    if (filter === 'low') where.stock = { gt: 0, lte: LOW_STOCK_THRESHOLD }
    if (filter === 'out') where.stock = { lte: 0 }
    const products = await db.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 300,
      select: {
        id: true, name: true, slug: true, priceCents: true, compareAtCents: true, stock: true, sku: true, images: true, tags: true,
        isActive: true, isFeatured: true, updatedAt: true, category: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
      },
    })
    return NextResponse.json({ products })
  } catch (error) {
    console.error('GET /api/admin/store/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const { value, errors } = await parseProductInput(body)
    if (Object.keys(errors).length) return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 422 })
    const product = await db.product.create({ data: value })
    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/store/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
