/** Sample catalogue for a fresh store (admin "Create sample catalogue"). Text only — no images. */
import { db } from '@/lib/db'
import { SAMPLE_TAG } from './config'

const SAMPLE_PREFIX = 'Sample — edit or delete.\n\n'

const CATEGORIES = [
  { name: 'Vibrators & wands', slug: 'vibrators-wands', description: 'Body-safe silicone, whisper-quiet motors, USB rechargeable.', order: 0 },
  { name: 'Couples', slug: 'couples', description: 'Designed to be shared.', order: 1 },
  { name: 'For him', slug: 'for-him', description: 'Thoughtful essentials for him.', order: 2 },
  { name: 'Wellness & lubes', slug: 'wellness-lubes', description: 'Lubricants, massage oils and intimate care.', order: 3 },
]

const PRODUCTS: { name: string; slug: string; cat: string; price: number; compareAt?: number; stock: number; featured?: boolean; tags: string[]; description: string; sku: string; weight: number }[] = [
  {
    name: 'Velvet Wand', slug: 'sample-velvet-wand', cat: 'vibrators-wands', price: 129900, compareAt: 149900, stock: 12, featured: true, sku: 'SMP-WAND-01', weight: 420,
    tags: ['wand', 'rechargeable', 'silicone'],
    description: 'A full-size massage wand with a soft, flexible head and deep, rumbly vibration.\n\n• 10 intensity settings\n• Body-safe silicone head\n• USB-C rechargeable, up to 2 hours per charge\n• Splash-proof',
  },
  {
    name: 'Pebble Mini', slug: 'sample-pebble-mini', cat: 'vibrators-wands', price: 59900, stock: 25, sku: 'SMP-MINI-02', weight: 90,
    tags: ['compact', 'travel', 'rechargeable'],
    description: 'Palm-sized and discreet enough for a handbag — surprisingly powerful for its size.\n\n• 7 patterns\n• Travel lock\n• Waterproof (IPX7)',
  },
  {
    name: 'Duet Couples Ring', slug: 'sample-duet-couples-ring', cat: 'couples', price: 74900, stock: 8, featured: true, sku: 'SMP-DUET-03', weight: 60,
    tags: ['couples', 'ring', 'rechargeable'],
    description: 'A stretchy, body-safe ring with a gentle vibrating bullet — designed to be enjoyed together.\n\n• Soft, stretchy silicone\n• 5 vibration modes\n• Rechargeable',
  },
  {
    name: 'Weekend Away Gift Set', slug: 'sample-weekend-away-set', cat: 'couples', price: 99900, compareAt: 124900, stock: 2, sku: 'SMP-SET-04', weight: 650,
    tags: ['gift', 'couples', 'set'],
    description: 'A curated box for two: massage candle, silk blindfold, feather tickler and a travel-size water-based lubricant. Arrives gift-ready in an unbranded box.',
  },
  {
    name: 'Sleeve Classic', slug: 'sample-sleeve-classic', cat: 'for-him', price: 44900, stock: 15, sku: 'SMP-HIM-05', weight: 300,
    tags: ['for him', 'sleeve'],
    description: 'A soft-touch textured sleeve in a discreet, easy-clean case.\n\n• Phthalate-free TPE\n• Open-ended for easy cleaning\n• Use with water-based lubricant',
  },
  {
    name: 'Silk Water-Based Lubricant 100 ml', slug: 'sample-silk-lube-100', cat: 'wellness-lubes', price: 18900, stock: 40, featured: true, sku: 'SMP-LUBE-06', weight: 130,
    tags: ['lube', 'water-based', 'toy-safe'],
    description: 'Silky, long-lasting and fragrance-free. Safe with condoms and all toys.\n\n• pH-balanced\n• Glycerine- and paraben-free\n• 100 ml pump bottle',
  },
  {
    name: 'Warming Massage Oil', slug: 'sample-warming-massage-oil', cat: 'wellness-lubes', price: 22900, stock: 0, sku: 'SMP-OIL-07', weight: 180,
    tags: ['massage', 'oil'],
    description: 'A lightly warming massage oil with sweet almond and vanilla. For external use only.',
  },
  {
    name: 'Toy Cleaner Spray', slug: 'sample-toy-cleaner', cat: 'wellness-lubes', price: 12900, stock: 30, sku: 'SMP-CLEAN-08', weight: 120,
    tags: ['care', 'cleaner'],
    description: 'Gentle, alcohol-free cleaner for silicone, glass and metal toys. Spray, wipe, done.',
  },
]

/** Create the sample categories/products that don't exist yet. Returns how many were created. */
export async function seedSampleCatalogue(): Promise<{ categories: number; products: number }> {
  let categories = 0
  let products = 0
  const ids: Record<string, string> = {}
  for (const c of CATEGORIES) {
    const existing = await db.productCategory.findUnique({ where: { slug: c.slug }, select: { id: true } })
    if (existing) { ids[c.slug] = existing.id; continue }
    const created = await db.productCategory.create({ data: c, select: { id: true } })
    ids[c.slug] = created.id
    categories++
  }
  for (const p of PRODUCTS) {
    const exists = await db.product.findFirst({ where: { OR: [{ slug: p.slug }, { sku: p.sku }] }, select: { id: true } })
    if (exists) continue
    await db.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: SAMPLE_PREFIX + p.description,
        priceCents: p.price,
        compareAtCents: p.compareAt ?? null,
        categoryId: ids[p.cat] ?? null,
        stock: p.stock,
        sku: p.sku,
        weightGrams: p.weight,
        tags: [SAMPLE_TAG, ...p.tags],
        isActive: true,
        isFeatured: !!p.featured,
      },
    })
    products++
  }
  return { categories, products }
}
