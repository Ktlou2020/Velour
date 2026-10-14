/** Catalogue queries and client-safe product shapes (server only). */
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { LOW_STOCK_THRESHOLD, SAMPLE_TAG, SORTS, type SortKey } from './config'

export interface ProductCardData {
  id: string
  slug: string
  name: string
  priceCents: number
  compareAtCents: number | null
  image: string | null
  stock: number
  categoryName: string | null
  categorySlug: string | null
  isSample: boolean
  isFeatured: boolean
}

export interface CategoryData {
  id: string
  name: string
  slug: string
  description: string | null
  productCount: number
}

export const cardSelect = {
  id: true, slug: true, name: true, priceCents: true, compareAtCents: true, images: true, stock: true,
  tags: true, isFeatured: true, category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>

/** Thumbnail variant of a stored product image URL. */
export function thumbOf(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('/api/media/') && !url.includes('?') ? `${url}?size=thumb` : url
}

export function toCard(p: CardRow): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents && p.compareAtCents > p.priceCents ? p.compareAtCents : null,
    image: thumbOf(p.images[0]),
    stock: p.stock,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
    isSample: p.tags.includes(SAMPLE_TAG),
    isFeatured: p.isFeatured,
  }
}

export function isLowStock(stock: number): boolean {
  return stock > 0 && stock <= LOW_STOCK_THRESHOLD
}

export async function listCategories(): Promise<CategoryData[]> {
  const rows = await db.productCategory.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, description: true, _count: { select: { products: { where: { isActive: true } } } } },
  })
  return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, productCount: c._count.products }))
}

export interface SearchParams {
  q?: string
  category?: string // slug
  min?: number // cents
  max?: number // cents
  inStock?: boolean
  sort?: SortKey
  page?: number
}

export const PAGE_SIZE = 24

/** Read search/filter params from a URL query (all optional, all validated). */
export function parseSearchParams(sp: Record<string, string | string[] | undefined>): SearchParams {
  const one = (k: string) => {
    const v = sp[k]
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
  }
  const rand = (k: string) => {
    const v = one(k)
    if (!v || !/^\d{1,7}$/.test(v.trim())) return undefined
    return Number(v.trim()) * 100
  }
  const sort = one('sort')
  const page = Number(one('page'))
  const q = (one('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const category = (one('category') ?? '').trim().slice(0, 80)
  return {
    q: q || undefined,
    category: category && /^[a-z0-9-]+$/.test(category) ? category : undefined,
    min: rand('min'),
    max: rand('max'),
    inStock: one('stock') === '1',
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : undefined,
    page: Number.isInteger(page) && page > 1 && page < 1000 ? page : 1,
  }
}

export function hasActiveFilters(p: SearchParams): boolean {
  return !!(p.q || p.min !== undefined || p.max !== undefined || p.inStock || (p.sort && p.sort !== 'featured') || (p.page ?? 1) > 1)
}

export async function searchProducts(p: SearchParams): Promise<{ items: ProductCardData[]; total: number; page: number; pages: number }> {
  const where: Prisma.ProductWhereInput = { isActive: true }
  const and: Prisma.ProductWhereInput[] = []
  if (p.category) and.push({ category: { slug: p.category } })
  if (p.q) {
    const words = p.q.toLowerCase().split(' ').filter(Boolean).slice(0, 5)
    for (const w of words) {
      and.push({
        OR: [
          { name: { contains: w, mode: 'insensitive' } },
          { description: { contains: w, mode: 'insensitive' } },
          { tags: { has: w } },
          { category: { name: { contains: w, mode: 'insensitive' } } },
        ],
      })
    }
  }
  if (p.min !== undefined || p.max !== undefined) {
    and.push({ priceCents: { ...(p.min !== undefined ? { gte: p.min } : {}), ...(p.max !== undefined ? { lte: p.max } : {}) } })
  }
  if (p.inStock) and.push({ stock: { gt: 0 } })
  if (and.length) where.AND = and

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    p.sort === 'newest' ? [{ createdAt: 'desc' }]
      : p.sort === 'price-asc' ? [{ priceCents: 'asc' }, { createdAt: 'desc' }]
        : p.sort === 'price-desc' ? [{ priceCents: 'desc' }, { createdAt: 'desc' }]
          : [{ isFeatured: 'desc' }, { createdAt: 'desc' }]

  const page = p.page ?? 1
  const [rows, total] = await Promise.all([
    db.product.findMany({ where, orderBy, select: cardSelect, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.product.count({ where }),
  ])
  // In-stock items first within the chosen order (sold-out items sink).
  const items = rows.map(toCard).sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

export async function featuredProducts(take = 8): Promise<ProductCardData[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
    select: cardSelect,
    take,
  })
  return rows.map(toCard)
}

export async function newestProducts(take = 8): Promise<ProductCardData[]> {
  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: cardSelect,
    take,
  })
  return rows.map(toCard)
}

export async function getProductBySlug(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null
  return db.product.findFirst({
    where: { slug, isActive: true },
    select: {
      ...cardSelect, description: true, sku: true, weightGrams: true, categoryId: true,
    },
  })
}

export async function relatedProducts(product: { id: string; categoryId: string | null; tags: string[] }, take = 4): Promise<ProductCardData[]> {
  const tags = product.tags.filter((t) => t !== SAMPLE_TAG)
  const rows = await db.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      OR: [
        ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
        ...(tags.length ? [{ tags: { hasSome: tags } }] : []),
      ],
    },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    select: cardSelect,
    take,
  })
  if (rows.length < take) {
    const more = await db.product.findMany({
      where: { isActive: true, id: { notIn: [product.id, ...rows.map((r) => r.id)] } },
      orderBy: { createdAt: 'desc' },
      select: cardSelect,
      take: take - rows.length,
    })
    rows.push(...more)
  }
  return rows.map(toCard)
}
