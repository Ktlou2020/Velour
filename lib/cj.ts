/**
 * CJ Dropshipping API v2 client.
 * Docs: https://developers.cjdropshipping.com/api2.0/v1/
 *
 * Access token is fetched once and cached in memory for its TTL (~24h).
 * All monetary values from CJ are USD; we convert to ZAR cents using
 * CJ_USD_TO_ZAR env var (default 18.50) and apply the markup.
 */

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1'
const CJ_EMAIL = process.env.CJ_EMAIL!
const CJ_API_KEY = process.env.CJ_API_KEY!

/** ZAR per USD exchange rate (set in Railway env). */
const USD_TO_ZAR = parseFloat(process.env.CJ_USD_TO_ZAR ?? '18.50')

/** Store markup applied on top of CJ cost (0.35 = 35%). */
const MARKUP = parseFloat(process.env.CJ_MARKUP ?? '0.35')

// ─── Token cache ────────────────────────────────────────────────────────────

let _token: string | null = null
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CJ_EMAIL, password: CJ_API_KEY }),
  })
  const data = await res.json()
  if (!data.result) throw new Error(`CJ auth failed: ${data.message}`)
  _token = data.data.accessToken as string
  // CJ tokens expire in 24h; refresh 5 minutes early
  _tokenExpiry = Date.now() + (23 * 60 + 55) * 60 * 1000
  return _token
}

async function cjGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const token = await getToken()
  const url = new URL(`${CJ_BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), { headers: { 'CJ-Access-Token': token } })
  const data = await res.json()
  if (!data.result) throw new Error(`CJ API error (${path}): ${data.message}`)
  return data.data as T
}

async function cjPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${CJ_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.result) throw new Error(`CJ API error (${path}): ${data.message}`)
  return data.data as T
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CJProduct {
  pid: string
  productNameEn: string
  description: string
  categoryName: string
  sellPrice: number       // USD
  productWeight: number   // grams
  productImage: string
  variantList: CJVariant[]
}

export interface CJVariant {
  vid: string
  variantNameEn: string
  variantSellPrice: number
  variantImage: string
  variantStock: number
}

export interface CJProductListPage {
  list: CJProduct[]
  pageNum: number
  pageSize: number
  total: number
}

export interface CJOrder {
  orderId: string
  orderNum: string
}

// ─── Price helpers ────────────────────────────────────────────────────────────

/** Convert CJ USD price to ZAR cents with markup applied. */
export function toCents(usdPrice: number): number {
  return Math.round(usdPrice * USD_TO_ZAR * (1 + MARKUP) * 100)
}

// ─── Product search ───────────────────────────────────────────────────────────

/**
 * Search CJ catalogue.
 * categoryKeyword: e.g. "adult", "sex toy", "intimate", "vibrator"
 */
export async function searchCJProducts(opts: {
  categoryKeyword?: string
  keyword?: string
  pageNum?: number
  pageSize?: number
}): Promise<CJProductListPage> {
  return cjGet<CJProductListPage>('/product/list', {
    categoryKeyword: opts.categoryKeyword ?? 'adult',
    productNameEn: opts.keyword ?? '',
    pageNum: opts.pageNum ?? 1,
    pageSize: Math.min(opts.pageSize ?? 20, 200),
  })
}

/** Fetch a single product with full variant list. */
export async function getCJProduct(pid: string): Promise<CJProduct> {
  return cjGet<CJProduct>('/product/query', { pid })
}

// ─── Order creation ───────────────────────────────────────────────────────────

export interface CJOrderLine {
  vid: string
  quantity: number
}

export interface CJShippingAddress {
  name: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  province: string
  country: string
  zip: string
}

export async function createCJOrder(opts: {
  orderNumber: string
  lines: CJOrderLine[]
  shipping: CJShippingAddress
  remark?: string
}): Promise<CJOrder> {
  return cjPost<CJOrder>('/shopping/order/createOrder', {
    orderNum: opts.orderNumber,
    shippingZip: opts.shipping.zip,
    shippingCountryCode: 'ZA',
    shippingCountry: 'South Africa',
    shippingProvince: opts.shipping.province,
    shippingCity: opts.shipping.city,
    shippingAddress: opts.shipping.addressLine1,
    shippingAddress2: opts.shipping.addressLine2 ?? '',
    shippingCustomerName: opts.shipping.name,
    shippingPhone: opts.shipping.phone,
    remark: opts.remark ?? 'Discreet packaging please. No brand markings.',
    products: opts.lines.map(l => ({ vid: l.vid, quantity: l.quantity })),
  })
}
