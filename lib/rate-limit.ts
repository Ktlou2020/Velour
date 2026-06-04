interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter.
 * @param identifier  IP address or email to rate-limit
 * @param limit       Maximum number of requests allowed in the window
 * @param windowMs    Window size in milliseconds
 * @returns true if the request is allowed, false if rate-limited
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Clean up expired entries
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }

  const entry = store.get(identifier);

  if (!entry || entry.resetAt <= now) {
    // First request in this window
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}
