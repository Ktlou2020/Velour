import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { parseCategoryInput } from '@/lib/store/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const categories = await db.productCategory.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, description: true, order: true, _count: { select: { products: true } } },
    })
    return NextResponse.json({ categories: categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })) })
  } catch (error) {
    console.error('GET /api/admin/store/categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST { name, slug?, description? } → create;  POST { reorder: [id, …] } → set order. */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    if (Array.isArray(body.reorder)) {
      const ids = body.reorder.filter(isValidId).slice(0, 200)
      await db.$transaction(ids.map((id, i) => db.productCategory.updateMany({ where: { id }, data: { order: i } })))
      return NextResponse.json({ ok: true })
    }
    const { value, errors } = await parseCategoryInput(body)
    if (Object.keys(errors).length) return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 422 })
    const max = await db.productCategory.aggregate({ _max: { order: true } })
    const category = await db.productCategory.create({ data: { ...value, order: value.order ?? (max._max.order ?? -1) + 1 } })
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/store/categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
