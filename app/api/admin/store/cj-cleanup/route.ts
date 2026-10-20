/**
 * POST /api/admin/store/cj-cleanup
 * Deletes CJ-imported products that belong to hardware/tool/non-adult categories.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const BLOCKED_FRAGMENTS = [
  'hand tool', 'power tool', 'tool set', 'drill', 'construction', 'building material',
  'hardware', 'automotive', 'kitchen', 'garden', 'cookware', 'furniture',
  'phone', 'computer', 'laptop', 'tablet', 'camera',
  'baby', 'children', 'kids', 'toy car',
  'outdoor', 'camping', 'bicycle',
  'pet supply', 'office', 'stationery',
  'concrete', 'tiling', 'plumbing',
]

export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cjProducts = await db.product.findMany({
    where: { cjPid: { not: null } },
    select: { id: true, name: true, category: { select: { name: true } } },
  })

  const toDelete = cjProducts.filter((p) => {
    const cat = (p.category?.name ?? '').toLowerCase()
    return BLOCKED_FRAGMENTS.some((f) => cat.includes(f))
  })

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0, message: 'No non-adult products found' })
  }

  await db.product.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } })

  return NextResponse.json({ deleted: toDelete.length, names: toDelete.map((p) => p.name).slice(0, 10) })
}
