/**
 * POST /api/admin/store/cj-sync
 *
 * Pulls adult wellness / lingerie / costume products from CJ Dropshipping
 * and upserts them into the local Product catalogue. Idempotent on cjPid.
 *
 * Body (optional):
 *   { keywords?: string[]; pages?: number }
 *
 * Returns: { created, updated, skipped, errors, totalFetched }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { searchCJProducts, getCJProduct, toCents } from '@/lib/cj'
import slugify from 'slugify'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Keywords to search — each runs up to `pages` pages
const DEFAULT_KEYWORDS = [
  'sex toy',
  'dildo',
  'masturbator',
  'clitoral vibrator',
  'anal plug',
  'cock ring',
  'lingerie women',
  'erotic lingerie',
  'sexy costume adult',
  'adult toy women',
]

// Block products whose CJ category contains any of these (case-insensitive)
const BLOCKED_CATEGORY_FRAGMENTS = [
  'hand tool', 'power tool', 'tool set', 'drill', 'construction', 'building material',
  'hardware', 'automotive', 'kitchen', 'garden', 'cookware', 'furniture',
  'phone', 'computer', 'laptop', 'tablet', 'camera',
  'baby', 'children', 'kids', 'toy car',
  'outdoor', 'camping', 'bicycle',
  'pet supply', 'office', 'stationery',
  'concrete', 'tiling', 'plumbing',
]

function isBlockedCategory(categoryName: string): boolean {
  const lower = categoryName.toLowerCase()
  return BLOCKED_CATEGORY_FRAGMENTS.some((f) => lower.includes(f))
}


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
  const keywords: string[] = Array.isArray(body.keywords) ? body.keywords : DEFAULT_KEYWORDS
  const pages: number = Math.min(body.pages ?? 3, 10)

  let created = 0, updated = 0, skipped = 0
  const errors: string[] = []
  let totalFetched = 0
  const seenPids = new Set<string>()

  for (const keyword of keywords) {
    for (let page = 1; page <= pages; page++) {
      let list
      try {
        const result = await searchCJProducts({ keyword, pageNum: page, pageSize: 20 })
        list = result.list
        totalFetched += list?.length ?? 0
        await sleep(1100)
      } catch (e) {
        errors.push(`"${keyword}" page ${page}: ${(e as Error).message}`)
        await sleep(2000)
        break
      }

      if (!list?.length) break

      for (const item of list) {
        // De-duplicate across keyword searches
        if (seenPids.has(item.pid)) { skipped++; continue }
        seenPids.add(item.pid)

        // Skip hardware, tools, electronics, etc.
        if (isBlockedCategory(item.categoryName || '')) { skipped++; continue }

        try {
          const product = await getCJProduct(item.pid).catch(() => item as typeof item)
          await sleep(1100)
          const variants = (product as typeof item & { variantList?: { variantStock?: number; variantSellPrice?: number }[] }).variantList ?? []
          const primaryVariant = variants[0]

          const costUsd = primaryVariant?.variantSellPrice ?? item.sellPrice ?? 0
          if (!costUsd) { skipped++; continue }

          const priceCents = toCents(costUsd)
          if (!isFinite(priceCents) || priceCents <= 0) { skipped++; continue }

          const stock = variants.reduce((s: number, v: { variantStock?: number }) => s + (v.variantStock ?? 0), 0) || 99
          const categoryId = await ensureCategory(item.categoryName || 'Adult Wellness')
          const slug = toSlug(item.productNameEn, item.pid)

          const images: string[] = []
          if (item.productImage) images.push(item.productImage)
          variants.forEach((v: { variantImage?: string }) => { if (v.variantImage && !images.includes(v.variantImage)) images.push(v.variantImage) })

          // Use upsert on slug as well to avoid unique constraint races
          const existingProduct = await db.product.findFirst({
            where: { OR: [{ cjPid: item.pid }, { slug }] },
            select: { id: true },
          })

          if (existingProduct) {
            await db.product.update({
              where: { id: existingProduct.id },
              data: { priceCents, stock, images, cjPid: item.pid, updatedAt: new Date() },
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
  }

  const totalInDb = await db.product.count({ where: { isActive: true } })
  return NextResponse.json({ created, updated, skipped, errors, totalFetched, totalInDb, keywordsSearched: keywords })
}
