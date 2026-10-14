/**
 * Store branding and fixed rules — the ONE place to rename the store.
 *
 * Pure constants only (no env), so this file is safe to import from client
 * components. Env-driven settings (shipping, discreet sender name) live in
 * lib/store/settings.ts (server) and reach the client through StoreProvider.
 */

/** Public name of the adult store. Rename here and everywhere follows. */
export const STORE_NAME = 'Toystory'

/** One-line strap shown under the name. */
export const STORE_TAGLINE = 'Intimate essentials, chosen with care and delivered discreetly.'

/** Order numbers look like `${ORDER_NUMBER_PREFIX}-10023`. */
export const ORDER_NUMBER_PREFIX = 'TS'
export const ORDER_NUMBER_START = 10001

/** Minutes an unpaid order keeps its stock reserved before it is released. */
export const RESERVATION_MINUTES = 30

/** At or below this many units a product shows "Low stock". */
export const LOW_STOCK_THRESHOLD = 3

/** Maximum units of one product per order. */
export const MAX_QTY_PER_LINE = 10
export const MAX_LINES_PER_ORDER = 30

export const VAT_RATE_PERCENT = 15

/** Tag that marks the sample catalogue (shown with a "Sample" badge). */
export const SAMPLE_TAG = 'sample'

export const STORE_TERMS_HREF = '/terms#store-terms'
export const SUPPORT_EMAIL = 'support@hush.dating'

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const

export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

/** Couriers offered in the admin "mark shipped" form. `site` is the courier's home page. */
export const COURIERS: { name: string; site?: string }[] = [
  { name: 'The Courier Guy', site: 'https://www.thecourierguy.co.za' },
  { name: 'Aramex', site: 'https://www.aramex.co.za' },
  { name: 'Pargo', site: 'https://pargo.co.za' },
  { name: 'PostNet', site: 'https://www.postnet.co.za' },
  { name: 'Paxi', site: 'https://www.paxi.co.za' },
  { name: 'Dawn Wing', site: 'https://www.dawnwing.co.za' },
  { name: 'Other' },
]

export const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
] as const
export type SortKey = (typeof SORTS)[number]['key']
