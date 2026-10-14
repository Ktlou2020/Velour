/** Formatting helpers shared by server and client. */

const NBSP = ' '

/**
 * Rand amount from integer cents: "R 1 299.00" (non-breaking spaces as the
 * thousands separator, '.' decimal — the house style asked for).
 */
export function formatRand(cents: number): string {
  const neg = cents < 0
  const abs = Math.abs(Math.round(cents))
  const rands = Math.floor(abs / 100)
  const c = String(abs % 100).padStart(2, '0')
  const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${neg ? '-' : ''}R${NBSP}${grouped}.${c}`
}

/** Parse a rand amount typed by an admin ("1299", "1 299.50", "1299,50", "R 99") → cents, or null. */
export function parseRandInput(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null
  if (typeof input !== 'string') return null
  let s = input.trim().replace(/^R\s*/i, '').replace(/[\s ]/g, '')
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}

/** Cents → plain "1299.00" for form inputs. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg',
  })
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' })
}

/** URL slug from a name. */
export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Plain text only: strip tags and control characters, normalise line breaks. */
export function plainText(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/<\/?[a-z!][^>]*>/gi, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/** Single-line plain text. */
export function lineText(s: unknown, max: number): string {
  return plainText(s, max * 2).replace(/\s+/g, ' ').trim().slice(0, max)
}
