/**
 * Simple fixed-window, in-memory rate limiter.
 *
 * State lives in this Node process only: it is reset on restart and is NOT
 * shared between replicas. That is fine for a single Railway instance; if the
 * app is ever scaled horizontally, move this to Redis (or similar).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()
let lastSweep = 0
const SWEEP_INTERVAL_MS = 60 * 1000
const MAX_KEYS = 50_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS && store.size < MAX_KEYS) return
  lastSweep = now
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
  // Hard cap so a flood of unique keys can't exhaust memory.
  if (store.size >= MAX_KEYS) store.clear()
}

/**
 * @param identifier  Key to rate-limit (prefix it, e.g. `login:ip:1.2.3.4`)
 * @param limit       Maximum number of requests allowed in the window
 * @param windowMs    Window size in milliseconds
 * @returns true if the request is allowed, false if rate-limited
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(now)

  const entry = store.get(identifier)
  if (!entry || entry.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count += 1
  return true
}

/** Clear a key, e.g. after a successful login. */
export function resetRateLimit(identifier: string) {
  store.delete(identifier)
}

/**
 * Best-effort client IP. Railway's proxy appends the real client address to
 * X-Forwarded-For; the first entry is the original client.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  const first = xff?.split(',')[0]?.trim()
  if (first) return first
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

export const TOO_MANY_REQUESTS_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.'
