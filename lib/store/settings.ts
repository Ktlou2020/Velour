/**
 * Env-driven store settings (server only). Pass them to client components
 * via StoreProvider — never read process.env in client code.
 *
 *   STORE_SHIPPING_CENTS            flat delivery fee in cents (default 9900 = R 99)
 *   STORE_FREE_SHIPPING_OVER_CENTS  free delivery when the subtotal is at least this (default 100000 = R 1 000; 0 disables)
 *   STORE_DISCREET_SENDER           sender name printed on parcels (default "HS Trading")
 *   STORE_ADMIN_EMAIL               optional: also email new paid orders here
 */

export interface StoreSettings {
  shippingCents: number
  freeShippingOverCents: number
  discreetSender: string
}

function intEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : fallback
}

export function storeSettings(): StoreSettings {
  return {
    shippingCents: intEnv('STORE_SHIPPING_CENTS', 9900),
    freeShippingOverCents: intEnv('STORE_FREE_SHIPPING_OVER_CENTS', 100000),
    discreetSender: (process.env.STORE_DISCREET_SENDER ?? '').trim().slice(0, 60) || 'HS Trading',
  }
}

/** Delivery fee for a subtotal (shared rule — the client mirrors it via shippingFor in lib/store/pricing.ts). */
export { shippingFor } from './pricing'
