import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { STORE_ALBUM_NAME, mediaIdFromUrl } from '@/lib/media'
import { isValidId } from '@/lib/security'
import { deleteFiles, photoFileKeys } from '@/lib/storage'
import { parseProductInput } from '@/lib/store/admin'
import { centsToInput } from '@/lib/store/format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ product: { ...product, price: centsToInput(product.priceCents), compareAt: centsToInput(product.compareAtCents) } })
  } catch (error) {
    console.error('GET /api/admin/store/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Full update from the edit form, or a partial toggle ({ isActive } / { isFeatured } / { stock }). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const merged: Record<string, unknown> = {
      name: existing.name, slug: existing.slug, description: existing.description,
      price: centsToInput(existing.priceCents), compareAt: centsToInput(existing.compareAtCents),
      categoryId: existing.categoryId ?? '', stock: existing.stock, sku: existing.sku ?? '', weightGrams: existing.weightGrams ?? '',
      tags: existing.tags, isActive: existing.isActive, isFeatured: existing.isFeatured, images: existing.images,
      ...body,
    }
    const { value, errors } = await parseProductInput(merged, id)
    if (Object.keys(errors).length) return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 422 })
    // Stock: apply the admin's change as a delta against what their form loaded, so units
    // reserved by checkouts in the meantime aren't overwritten (and can't be oversold).
    const base = typeof body.stockBase === 'number' && Number.isInteger(body.stockBase) ? body.stockBase : null
    const { stock, ...rest } = value
    const product = await db.$transaction(async (tx) => {
      if (body.stock === undefined) return tx.product.update({ where: { id }, data: rest })
      if (base === null) return tx.product.update({ where: { id }, data: { ...rest, stock } })
      const delta = stock - base
      const updated = await tx.product.update({ where: { id }, data: { ...rest, stock: { increment: delta } } })
      return updated.stock < 0 ? tx.product.update({ where: { id }, data: { stock: 0 } }) : updated
    })
    // Photos removed from the product are deleted (unless another product uses them).
    const removed = existing.images.filter((u) => !value.images.includes(u))
    if (removed.length) cleanupImages(removed, id).catch(() => {})
    return NextResponse.json({ product })
  } catch (error) {
    console.error('PATCH /api/admin/store/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Delete a product. Past orders keep their item snapshot (name, price, quantity). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = await db.product.findUnique({ where: { id }, select: { images: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.product.delete({ where: { id } })
    if (existing.images.length) cleanupImages(existing.images, id).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/store/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function cleanupImages(urls: string[], productId: string) {
  // Order items keep their first image URL as a snapshot — don't delete those.
  const [stillUsed, inOrders] = await Promise.all([
    db.product.findMany({ where: { id: { not: productId }, images: { hasSome: urls } }, select: { images: true } }),
    db.orderItem.findMany({ where: { image: { in: urls } }, select: { image: true } }),
  ])
  const keep = new Set([...stillUsed.flatMap((p) => p.images), ...inOrders.map((i) => i.image)])
  const ids = urls.filter((u) => !keep.has(u)).map(mediaIdFromUrl).filter((x): x is string => !!x)
  if (!ids.length) return
  const photos = await db.photo.findMany({ where: { id: { in: ids }, album: { name: STORE_ALBUM_NAME } }, select: { id: true, storageKey: true, mimeType: true } })
  if (!photos.length) return
  await db.photo.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } })
  await deleteFiles(photos.flatMap(photoFileKeys))
}
