/** Admin-side validation for products and categories (server only). */
import { db } from '@/lib/db'
import { STORE_ALBUM_NAME, mediaIdFromUrl, mediaUrl } from '@/lib/media'
import { isValidId } from '@/lib/security'
import { lineText, parseRandInput, plainText, slugify } from './format'

export interface ProductInput {
  name: string
  slug: string
  description: string
  priceCents: number
  compareAtCents: number | null
  categoryId: string | null
  stock: number
  sku: string | null
  weightGrams: number | null
  tags: string[]
  isActive: boolean
  isFeatured: boolean
  images: string[]
}

export const MAX_PRODUCT_IMAGES = 8

function intOrNull(v: unknown, max: number): number | null | 'bad' {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isInteger(n) || n < 0 || n > max) return 'bad'
  return n
}

/** Validate a product form. Returns field errors (empty object = valid). */
export async function parseProductInput(raw: Record<string, unknown>, existingId?: string): Promise<{ value: ProductInput; errors: Record<string, string> }> {
  const errors: Record<string, string> = {}
  const name = lineText(raw.name, 120)
  if (name.length < 2) errors.name = 'Name is required'

  let slug = slugify(typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug : name)
  if (!slug) errors.slug = 'Slug is required'

  const description = plainText(raw.description, 5000)

  const priceCents = parseRandInput(raw.price)
  if (priceCents === null || priceCents < 100) errors.price = 'Enter a price of at least R 1.00'

  let compareAtCents: number | null = null
  if (raw.compareAt !== undefined && raw.compareAt !== null && String(raw.compareAt).trim() !== '') {
    compareAtCents = parseRandInput(raw.compareAt)
    if (compareAtCents === null) errors.compareAt = 'Enter a valid amount'
    else if (priceCents !== null && compareAtCents <= priceCents) errors.compareAt = 'Compare-at price must be higher than the price'
  }

  let categoryId: string | null = null
  if (typeof raw.categoryId === 'string' && raw.categoryId) {
    if (!isValidId(raw.categoryId) || !(await db.productCategory.findUnique({ where: { id: raw.categoryId }, select: { id: true } }))) {
      errors.categoryId = 'Unknown category'
    } else categoryId = raw.categoryId
  }

  const stock = intOrNull(raw.stock, 100000)
  if (stock === 'bad' || stock === null) errors.stock = 'Stock must be a whole number (0 or more)'

  const skuRaw = lineText(raw.sku, 60).toUpperCase()
  const sku = skuRaw || null
  if (sku && !/^[A-Z0-9._-]+$/.test(sku)) errors.sku = 'Use letters, numbers, dots, dashes or underscores'

  const weight = intOrNull(raw.weightGrams, 100000)
  if (weight === 'bad') errors.weightGrams = 'Weight must be whole grams'

  const tagsIn = Array.isArray(raw.tags) ? raw.tags : typeof raw.tags === 'string' ? raw.tags.split(',') : []
  const tags = [...new Set(tagsIn.map((t) => lineText(t, 30).toLowerCase()).filter(Boolean))].slice(0, 20)

  // Images: canonical /api/media/<id> URLs of store photos only.
  const imagesIn = Array.isArray(raw.images) ? raw.images : []
  const images: string[] = []
  if (imagesIn.length > MAX_PRODUCT_IMAGES) errors.images = `Up to ${MAX_PRODUCT_IMAGES} photos`
  else {
    const ids = imagesIn.map((u) => (typeof u === 'string' ? mediaIdFromUrl(u) : null))
    if (ids.some((id, i) => !id || imagesIn[i] !== mediaUrl(id))) errors.images = 'Invalid photo'
    else if (ids.length) {
      const ok = await db.photo.findMany({ where: { id: { in: ids as string[] }, album: { name: STORE_ALBUM_NAME } }, select: { id: true } })
      const okSet = new Set(ok.map((o) => o.id))
      if (ids.some((id) => !okSet.has(id!))) errors.images = 'Photos must be uploaded as product photos'
      else images.push(...[...new Set(imagesIn as string[])])
    }
  }

  // Unique slug / SKU
  if (!errors.slug && slug) {
    const base = slug
    for (let i = 2; i < 50; i++) {
      const clash = await db.product.findFirst({ where: { slug, ...(existingId ? { id: { not: existingId } } : {}) }, select: { id: true } })
      if (!clash) break
      // An explicitly typed slug that clashes is an error; an auto slug gets a suffix.
      if (typeof raw.slug === 'string' && raw.slug.trim()) { errors.slug = 'Another product uses this slug'; break }
      slug = `${base}-${i}`
    }
  }
  if (sku && !errors.sku) {
    const clash = await db.product.findFirst({ where: { sku, ...(existingId ? { id: { not: existingId } } : {}) }, select: { id: true } })
    if (clash) errors.sku = 'Another product uses this SKU'
  }

  return {
    value: {
      name, slug, description, priceCents: priceCents ?? 0, compareAtCents, categoryId,
      stock: typeof stock === 'number' ? stock : 0, sku, weightGrams: typeof weight === 'number' ? weight : null,
      tags, isActive: raw.isActive !== false, isFeatured: raw.isFeatured === true, images,
    },
    errors,
  }
}

export async function parseCategoryInput(raw: Record<string, unknown>, existingId?: string): Promise<{ value: { name: string; slug: string; description: string | null; order?: number }; errors: Record<string, string> }> {
  const errors: Record<string, string> = {}
  const name = lineText(raw.name, 60)
  if (name.length < 2) errors.name = 'Name is required'
  const slug = slugify(typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug : name)
  if (!slug) errors.slug = 'Slug is required'
  else {
    const clash = await db.productCategory.findFirst({ where: { slug, ...(existingId ? { id: { not: existingId } } : {}) }, select: { id: true } })
    if (clash) errors.slug = 'Another category uses this slug'
  }
  const description = plainText(raw.description, 300) || null
  const order = raw.order === undefined ? undefined : Number(raw.order)
  if (order !== undefined && (!Number.isInteger(order) || Math.abs(order) > 10000)) errors.order = 'Order must be a whole number'
  return { value: { name, slug, description, ...(order !== undefined ? { order } : {}) }, errors }
}
