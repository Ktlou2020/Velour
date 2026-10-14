import crypto from 'crypto'

/** bcrypt work factor for all newly created password hashes. */
export const BCRYPT_COST = 12

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

/**
 * Minimum password policy. Returns a user-facing error message, or null if
 * the password is acceptable.
 */
export function validatePassword(
  password: unknown,
  opts: { email?: string | null; username?: string | null } = {},
): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Password is required'
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`
  // bcrypt only uses the first 72 bytes; cap length to avoid DoS via huge inputs.
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters`
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number'
  }
  const lower = password.toLowerCase()
  const email = opts.email?.toLowerCase().trim()
  const username = opts.username?.toLowerCase().trim()
  if ((email && (lower === email || lower === email.split('@')[0])) || (username && lower === username)) {
    return 'Password must not be your email or username'
  }
  return null
}

/** Generate a random URL-safe token to email to the user (raw value never stored). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** SHA-256 of a token; this is what gets stored and looked up in the database. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** Basic shape check for ids coming from request bodies (Prisma cuid / uuid). */
export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id)
}
