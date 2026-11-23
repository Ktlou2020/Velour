/**
 * Support tickets: shared constants and helpers for /help/contact,
 * /api/support and the admin inbox at /admin/support.
 * Safe to import from client components (no server-only imports).
 */

export const SUPPORT_CATEGORIES = [
  { value: 'ACCOUNT', label: 'Account & login' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'BUG', label: 'Report a bug' },
  { value: 'FEEDBACK', label: 'Feedback' },
  { value: 'OTHER', label: 'Other' },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['value']

export const SUPPORT_STATUSES = ['OPEN', 'ANSWERED', 'CLOSED'] as const
export type SupportStatus = (typeof SUPPORT_STATUSES)[number]

export const SUBJECT_MAX = 120
export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 3000
export const REPLY_MAX = 5000
export const EMAIL_MAX = 254

export function isSupportCategory(v: unknown): v is SupportCategory {
  return typeof v === 'string' && SUPPORT_CATEGORIES.some((c) => c.value === v)
}

export function isSupportStatus(v: unknown): v is SupportStatus {
  return typeof v === 'string' && (SUPPORT_STATUSES as readonly string[]).includes(v)
}

export function categoryLabel(v: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v
}

/** Short reference shown to the member: last 6 characters of the id, uppercased. */
export function ticketRef(id: string): string {
  return id.slice(-6).toUpperCase()
}

export function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/** Trim and strip control characters (keeps newlines and tabs for multi-line text). */
export function cleanText(v: unknown, multiline = false): string {
  if (typeof v !== 'string') return ''
  const s = multiline
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    : v.replace(/[\u0000-\u001F\u007F]/g, ' ')
  return s.trim()
}
