'use client'

/**
 * Cart (client only): localStorage, keyed per member, shared by every
 * component through useSyncExternalStore. Prices/stock here are a display
 * snapshot — the server re-prices everything (POST /api/store/cart/quote and
 * at checkout).
 */
import { useSyncExternalStore } from 'react'
import { MAX_QTY_PER_LINE, MAX_LINES_PER_ORDER } from './config'

export interface CartItem {
  productId: string
  slug: string
  name: string
  image: string | null
  priceCents: number
  stock: number
  quantity: number
}

const EMPTY: CartItem[] = []
const listeners = new Set<() => void>()
let currentKey: string | null = null
let cacheRaw: string | null = null
let cacheItems: CartItem[] = EMPTY
/** Set when localStorage refuses writes (private mode, quota): keep the cart in memory. */
let memoryOnly = false

export function cartKey(userId: string): string {
  return `hush_store_cart:${userId}`
}

function readRaw(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function parse(raw: string | null): CartItem[] {
  if (!raw) return EMPTY
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return EMPTY
    return data
      .filter((x): x is CartItem => !!x && typeof x === 'object' && typeof (x as CartItem).productId === 'string' && Number.isInteger((x as CartItem).quantity))
      .map((x) => ({
        productId: x.productId,
        slug: String(x.slug ?? ''),
        name: String(x.name ?? ''),
        image: typeof x.image === 'string' ? x.image : null,
        priceCents: Number.isInteger(x.priceCents) ? x.priceCents : 0,
        stock: Number.isInteger(x.stock) ? x.stock : 0,
        quantity: Math.max(1, Math.min(MAX_QTY_PER_LINE, x.quantity)),
      }))
      .slice(0, MAX_LINES_PER_ORDER)
  } catch {
    return EMPTY
  }
}

function snapshot(): CartItem[] {
  if (!currentKey) return EMPTY
  if (memoryOnly) return cacheItems
  const raw = readRaw(currentKey)
  if (raw !== cacheRaw) {
    cacheRaw = raw
    cacheItems = parse(raw)
  }
  return cacheItems
}

function write(items: CartItem[]) {
  if (!currentKey) return
  const raw = items.length ? JSON.stringify(items) : null
  try {
    if (raw) localStorage.setItem(currentKey, raw)
    else localStorage.removeItem(currentKey)
  } catch {
    memoryOnly = true // storage unavailable: keep it in memory for this page view
  }
  cacheRaw = raw
  cacheItems = items.length ? items : EMPTY
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => { if (e.key === currentKey) l() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage) }
}

/** Point the cart at this member's storage key (called by StoreProvider). */
export function setCartOwner(userId: string | null) {
  const key = userId ? cartKey(userId) : null
  if (key === currentKey) return
  currentKey = key
  cacheRaw = null
  cacheItems = EMPTY
  listeners.forEach((l) => l())
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}

function clampQty(q: number, stock: number): number {
  return Math.max(0, Math.min(q, stock, MAX_QTY_PER_LINE))
}

export const cart = {
  get: snapshot,
  /** Add `qty` of a product. Returns the quantity now in the cart (clamped to stock). */
  add(item: Omit<CartItem, 'quantity'>, qty: number): number {
    const items = snapshot()
    const existing = items.find((i) => i.productId === item.productId)
    const want = (existing?.quantity ?? 0) + qty
    const q = clampQty(want, item.stock)
    if (q <= 0) return 0
    const next = existing
      ? items.map((i) => (i.productId === item.productId ? { ...i, ...item, quantity: q } : i))
      : [...items, { ...item, quantity: q }].slice(-MAX_LINES_PER_ORDER)
    write(next)
    return q
  },
  setQuantity(productId: string, qty: number) {
    const items = snapshot()
    write(items.flatMap((i) => {
      if (i.productId !== productId) return [i]
      const q = clampQty(qty, i.stock)
      return q > 0 ? [{ ...i, quantity: q }] : []
    }))
  },
  remove(productId: string) {
    write(snapshot().filter((i) => i.productId !== productId))
  },
  clear() {
    write([])
  },
  /** Replace the snapshot with the server's quote (prices, stock, clamped quantities; gone items removed). */
  applyQuote(lines: { productId: string; slug: string; name: string; image: string | null; priceCents: number; stock: number; quantity: number }[]) {
    write(lines.filter((l) => l.quantity > 0).map((l) => ({
      productId: l.productId, slug: l.slug, name: l.name, image: l.image, priceCents: l.priceCents, stock: l.stock, quantity: l.quantity,
    })))
  },
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0)
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.priceCents * i.quantity, 0)
}

/** Post a signed PayFast form (real <form>, fields in the given order). */
export function submitPayfastForm(form: { action: string; fields: [string, string][] }) {
  const el = document.createElement('form')
  el.method = 'POST'
  el.action = form.action
  el.acceptCharset = 'UTF-8'
  el.style.display = 'none'
  for (const [name, value] of form.fields) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    el.appendChild(input)
  }
  document.body.appendChild(el)
  el.submit()
}
