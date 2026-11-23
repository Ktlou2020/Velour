/**
 * One account per email address. `normalizeEmail` is what we store (trimmed,
 * lowercase). `canonicalEmail` is used only to detect duplicates: it also drops
 * "+tags" (john+2@x.com → john@x.com) and, for Gmail, dots in the name
 * (j.o.h.n@gmail.com → john@gmail.com), since those all reach the same inbox.
 * Keep in sync with scripts/backfill.mjs.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const GMAIL = new Set(['gmail.com', 'googlemail.com'])

export function canonicalEmail(email: string): string {
  const e = normalizeEmail(email)
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at)
  let domain = e.slice(at + 1)
  local = local.split('+')[0]
  if (GMAIL.has(domain)) {
    local = local.replace(/\./g, '')
    domain = 'gmail.com'
  }
  return `${local}@${domain}`
}
