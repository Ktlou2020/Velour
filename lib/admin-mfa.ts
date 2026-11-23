/**
 * Admin two-step login (server only).
 *
 * After their password, admins enter a 6-digit code from an authenticator app
 * (TOTP, RFC 6238: SHA-1, 30-second steps, ±1 step of clock drift) or one of
 * 10 single-use backup codes. Until then the session is a normal member's
 * (lib/auth.ts session callback) and admin pages send them to
 * /auth/admin-verify.
 *
 * Flow: /api/admin/2fa/verify checks the code and hands back a one-time
 * ticket (2 minutes); the browser passes it to NextAuth's session update, and
 * the jwt callback redeems it (redeemTicket) to mark the session verified.
 *
 * Switch off with ADMIN_2FA_REQUIRED=false (emergency only).
 */
import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashToken } from '@/lib/security'

export function mfaRequired(): boolean {
  return process.env.ADMIN_2FA_REQUIRED !== 'false'
}

// ── Base32 (RFC 4648, no padding) ────────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

// ── TOTP ─────────────────────────────────────────────────────────────────────
const STEP_SECONDS = 30

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS)
}

export function totpAt(secretB32: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const h = crypto.createHmac('sha1', base32Decode(secretB32)).update(counter).digest()
  const off = h[h.length - 1] & 0x0f
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 1_000_000).padStart(6, '0')
}

/** The matching step (±1 for clock drift), or null. Steps at or before `lastStep` are refused (no replays). */
export function matchTotp(secretB32: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const step = currentStep(now)
  for (const s of [step - 1, step, step + 1]) {
    if (lastStep !== null && s <= lastStep) continue
    const expected = totpAt(secretB32, s)
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return s
  }
  return null
}

export function newSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

export function otpauthUri(secretB32: string, account: string): string {
  const issuer = 'Unbound Admin'
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`
}

// ── Encryption at rest (AES-256-GCM, key derived from NEXTAUTH_SECRET) ────────
function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for two-step login')
  return crypto.createHash('sha256').update(`${secret}:admin-totp`).digest()
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.')
}

export function unseal(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split('.')
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('bad sealed value')
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8')
}

// ── Backup codes ─────────────────────────────────────────────────────────────
export function newRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const raw = base32Encode(crypto.randomBytes(5)).slice(0, 8).toLowerCase()
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
}

function normaliseRecovery(code: string): string {
  return code.toLowerCase().replace(/[^a-z2-7]/g, '')
}

export function hashRecovery(code: string): string {
  return hashToken(`recovery:${normaliseRecovery(code)}`)
}

// ── Tickets (verified code → session) ────────────────────────────────────────
const TICKET_MS = 2 * 60 * 1000

export async function issueTicket(userId: string): Promise<string> {
  const ticket = crypto.randomBytes(24).toString('base64url')
  await db.user.update({ where: { id: userId }, data: { mfaTicketHash: hashToken(ticket), mfaTicketExpires: new Date(Date.now() + TICKET_MS) } })
  return ticket
}

/** Used once by the jwt callback. True when the ticket belongs to this admin and hasn't expired. */
export async function redeemTicket(userId: string, ticket: unknown): Promise<boolean> {
  if (typeof ticket !== 'string' || ticket.length < 20 || ticket.length > 100) return false
  const r = await db.user.updateMany({
    where: { id: userId, role: 'ADMIN', mfaTicketHash: hashToken(ticket), mfaTicketExpires: { gt: new Date() } },
    data: { mfaTicketHash: null, mfaTicketExpires: null },
  })
  return r.count === 1
}

// ── Verify a code for an admin ───────────────────────────────────────────────
export type VerifyResult =
  | { ok: true; enabledNow: boolean; recoveryCodes?: string[]; usedRecovery: boolean; recoveryLeft: number }
  | { ok: false; error: string }

/**
 * Checks a 6-digit code (or a backup code). When two-step login isn't set up
 * yet, the code must match the pending secret from setup; that switches it on
 * and returns fresh backup codes (shown once).
 */
export async function verifyAdminCode(userId: string, input: string): Promise<VerifyResult> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, totpSecret: true, totpPendingSecret: true, totpEnabledAt: true, totpLastStep: true, totpRecoveryHashes: true },
  })
  if (!u || u.role !== 'ADMIN') return { ok: false, error: 'Admins only' }
  const code = input.trim().replace(/\s/g, '')

  if (!u.totpEnabledAt || !u.totpSecret) {
    if (!u.totpPendingSecret) return { ok: false, error: 'Start the setup again' }
    const step = matchTotp(unseal(u.totpPendingSecret), code, null)
    if (step === null) return { ok: false, error: 'That code didn’t match — check the time on your phone and try the newest code' }
    const recoveryCodes = newRecoveryCodes()
    await db.user.update({
      where: { id: userId },
      data: {
        totpSecret: u.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date(), totpLastStep: step,
        totpRecoveryHashes: recoveryCodes.map(hashRecovery),
      },
    })
    return { ok: true, enabledNow: true, recoveryCodes, usedRecovery: false, recoveryLeft: recoveryCodes.length }
  }

  if (/^\d{6}$/.test(code)) {
    const secret = unseal(u.totpSecret)
    const step = matchTotp(secret, code, u.totpLastStep)
    if (step === null) {
      const reused = matchTotp(secret, code, null) !== null
      return { ok: false, error: reused ? 'That code was already used — wait for the next one' : 'That code didn’t match — try the newest code in your app' }
    }
    // Conditional update: two simultaneous requests can't both use the same code.
    const r = await db.user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    })
    if (r.count !== 1) return { ok: false, error: 'That code was already used — wait for the next one' }
    return { ok: true, enabledNow: false, usedRecovery: false, recoveryLeft: u.totpRecoveryHashes.length }
  }

  const h = hashRecovery(code)
  if (!normaliseRecovery(code) || !u.totpRecoveryHashes.includes(h)) return { ok: false, error: 'That code didn’t match' }
  await db.user.update({ where: { id: userId }, data: { totpRecoveryHashes: u.totpRecoveryHashes.filter((x) => x !== h) } })
  return { ok: true, enabledNow: false, usedRecovery: true, recoveryLeft: u.totpRecoveryHashes.length - 1 }
}

// ── New-device sign-in alerts ────────────────────────────────────────────────
/** "Chrome on Android" etc. from a user-agent string. */
export function describeDevice(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser'
  const os =
    /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'an unknown device'
  return `${browser} on ${os}`
}

export function deviceHash(userId: string, ua: string): string {
  // Browser + OS family only, so browser updates don't count as a new device.
  return hashToken(`device:${userId}:${describeDevice(ua)}`).slice(0, 32)
}
