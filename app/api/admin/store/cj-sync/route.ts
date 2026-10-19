/**
 * POST /api/admin/store/cj-sync
 *
 * Pulls adult wellness products from CJ Dropshipping and upserts them into
 * the local Product catalogue. Idempotent: matched on cjPid.
 *
 * Body (optional):
 *   { keyword?: string; pages?: number; categoryKeyword?: string }
 *
 * Returns: { created, updated, skipped, errors }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { searchCJProducts, getCJProduct, toCents } from '@/lib/cj'
import slugify from 'slugify'

function toSlug(name: string, pid: string): string {
  const base = slugify(name, { lower: true, strict: true }).slice(0, 60)
  return `${base}-${pid.slice(-6)}`
}

async function ensureCategory(name: string): Promise<string> {
  const slug = slugify(name, { lower: true, strict: true }).slice(0, 80)
  const cat = await db.productCategory.upsert({
    where: { slug },
    create: { name, slug },
    update: {},
    select: { id: true },
  })
  return cat.id
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const keyword: string = body.keyword ?? 'vibrator'
  const categoryKeyword: string = body.categoryKeyword ?? ''
  const pages: number = Math.min(body.pages ?? 3, 10)

  let created = 0, updated = 0, skipped = 0
  const errors: string[] = []
  let totalFetched = 0

  for (let page = 1; page <= pages; page++) {
    let list
    try {
      const result = await searchCJProducts({ keyword, categoryKeyword, pageNum: page, pageSize: 50 })
      list = result.list
      totalFetched += list?.length ?? 0
    } catch (e) {
      errors.push(`Page ${page} fetch failed: ${(e as Error).message}`)
      break
    }

    if (!list?.length) break

    for (const item of list) {
      try {
        // Fetch full product with variants for accurate stock/images
        const product = await getCJProduct(item.pid).catch(() => item as typeof item)
        const variants = (product as typeof item & { variantList?: { variantStock?: number; variantSellPrice?: number }[] }).variantList ?? []
        const primaryVariant = variants[0]

        const costUsd = primaryVariant?.variantSellPrice ?? item.sellPrice ?? 0
        if (!costUsd) { skipped++; continue }

        const priceCents = toCents(costUsd)
        const stock = variants.reduce((s: number, v: { variantStock?: number }) => s + (v.variantStock ?? 0), 0) || 99
        const categoryId = await ensureCategory(item.categoryName || 'Adult Wellness')
        const slug = toSlug(item.productNameEn, item.pid)

        const images: string[] = []
        if (item.productImage) images.push(item.productImage)
        variants.forEach((v: { variantImage?: string }) => { if (v.variantImage && !images.includes(v.variantImage)) images.push(v.variantImage) })

        const existingProduct = await db.product.findUnique({ where: { cjPid: item.pid }, select: { id: true } })

        if (existingProduct) {
          await db.product.update({
            where: { id: existingProduct.id },
            data: { priceCents, stock, images, updatedAt: new Date() },
          })
          updated++
        } else {
          await db.product.create({
            data: {
              slug,
              name: item.productNameEn,
              description: item.description || item.productNameEn,
              priceCents,
              categoryId,
              images,
              stock,
              weightGrams: Math.round((item.productWeight ?? 0) * 1000),
              cjPid: item.pid,
              cjVariantId: primaryVariant ? (primaryVariant as { vid?: string }).vid ?? null : null,
              tags: ['cj'],
              isActive: true,
            },
          })
          created++
        }
      } catch (e) {
        errors.push(`${item.pid}: ${(e as Error).message}`)
      }
    }
  }

  return NextResponse.json({ created, updated, skipped, errors, totalFetched })
}
