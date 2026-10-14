import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { parseCategoryInput } from '@/lib/store/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = await db.productCategory.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const { value, errors } = await parseCategoryInput({ name: existing.name, slug: existing.slug, description: existing.description, ...body }, id)
    if (Object.keys(errors).length) return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 422 })
    const category = await db.productCategory.update({ where: { id }, data: value })
    return NextResponse.json({ category })
  } catch (error) {
    console.error('PATCH /api/admin/store/categories/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Products in a deleted category become uncategorised (onDelete: SetNull). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const r = await db.productCategory.deleteMany({ where: { id } })
    if (!r.count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/store/categories/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
