// Shared helpers for the end-to-end tests (tests/e2e/*.test.mjs).
// The tests talk to a running production build over HTTP and read/write the
// test database directly. scripts/test-e2e.sh sets everything up; see
// tests/README.md.
import crypto from 'node:crypto'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3999'
export const SERVER_LOG = process.env.E2E_SERVER_LOG || ''
export const CRON_SECRET = process.env.CRON_SECRET || 'e2e-cron-secret'
export const PASSWORD = 'Passw0rd!x'
export const db = new PrismaClient()

let hash
async function passwordHash() {
  hash ??= await bcrypt.hash(PASSWORD, 8)
  return hash
}

/** Short random id so every test file uses its own usernames. */
export function rid(n = 6) {
  return crypto.randomBytes(8).toString('hex').slice(0, n)
}

function randomIp() {
  return `10.${crypto.randomInt(255)}.${crypto.randomInt(255)}.${crypto.randomInt(1, 255)}`
}

/**
 * Creates a member with a finished profile (unless overridden).
 * `user` fields go on User, `profile` fields on Profile.
 */
export async function makeUser(username, { user = {}, profile = {} } = {}) {
  return db.user.create({
    data: {
      email: `${username}@e2e.test`,
      username,
      passwordHash: await passwordHash(),
      emailVerifiedAt: new Date(),
      createdAt: new Date(Date.now() - 30 * 86400000),
      ...user,
      profile: {
        create: {
          displayName: username,
          dateOfBirth: new Date('1990-01-01'),
          country: 'South Africa',
          city: 'Durban',
          latitude: -29.86,
          longitude: 31.02,
          gender: 'WOMAN',
          interestedIn: ['MAN'],
          profilePhoto: '/api/media/x',
          lastSeen: new Date(),
          tourCompletedAt: new Date(),
          ...profile,
        },
      },
    },
  })
}

export async function matchAndChat(a, b) {
  await db.match.create({ data: { user1Id: a.id, user2Id: b.id } })
  return db.conversation.create({ data: { participants: { create: [{ userId: a.id }, { userId: b.id }] } } })
}

/** A browser-like HTTP client with its own cookies and its own client IP. */
export class Client {
  constructor() {
    this.cookies = new Map()
    this.ip = randomIp()
  }

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      const k = pair.slice(0, i).trim()
      const v = pair.slice(i + 1).trim()
      if (!v || /max-age=0/i.test(c)) this.cookies.delete(k)
      else this.cookies.set(k, v)
    }
  }

  /**
   * fetch with cookies. Follows redirects (keeping cookies) unless
   * { redirect: 'manual' }. Returns { status, url, headers, text, json, buf }.
   */
  async req(path, { method = 'GET', json, form, body, headers = {}, redirect = 'follow' } = {}) {
    let url = path.startsWith('http') ? path : BASE + path
    const h = { 'x-forwarded-for': this.ip, ...headers }
    let payload = body
    if (json !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(json) }
    if (form !== undefined) { h['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString() }
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { method, headers: { ...h, cookie: this.cookieHeader() }, body: payload, redirect: 'manual' })
      this.store(res)
      const loc = res.headers.get('location')
      if (redirect === 'follow' && res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).toString()
        method = 'GET'; payload = undefined
        delete h['content-type']
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const text = buf.toString('utf8')
      let parsed = null
      try { parsed = JSON.parse(text) } catch { /* not JSON */ }
      return { status: res.status, url, headers: res.headers, text, json: parsed, buf }
    }
    throw new Error(`too many redirects for ${path}`)
  }

  get(path, opts) { return this.req(path, opts) }
  post(path, json, opts = {}) { return this.req(path, { ...opts, method: 'POST', json }) }
  patch(path, json, opts = {}) { return this.req(path, { ...opts, method: 'PATCH', json }) }
  del(path, json, opts = {}) { return this.req(path, { ...opts, method: 'DELETE', json }) }

  async csrf() {
    return (await this.get('/api/auth/csrf')).json.csrfToken
  }

  async login(email, password = PASSWORD) {
    const csrfToken = await this.csrf()
    await this.req('/api/auth/callback/credentials', { method: 'POST', form: { email, password, csrfToken, json: 'true' }, redirect: 'manual' })
    return this
  }

  async session() {
    return (await this.get('/api/auth/session')).json
  }

  /** NextAuth session update (what useSession().update(data) sends). */
  async updateSession(data) {
    const csrfToken = await this.csrf()
    return this.post('/api/auth/session', { csrfToken, data })
  }

  /** Uploads a file (multipart). */
  async upload(fields, file) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    if (file) fd.append('file', new Blob([file.data], { type: file.type }), file.name)
    const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd, headers: { cookie: this.cookieHeader(), 'x-forwarded-for': this.ip } })
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

export async function login(email) {
  return new Client().login(email)
}

/** The super admin (SUPER_ADMIN_EMAILS=boss@e2e.test in scripts/test-e2e.sh), created once. */
export async function ensureBoss() {
  const found = await db.user.findUnique({ where: { email: 'boss@e2e.test' } })
  return found ?? makeUser('boss', { user: { email: 'boss@e2e.test', role: 'ADMIN' }, profile: { displayName: 'Boss' } })
}

/** Signs in as an admin and completes two-step login (setting it up the first time). */
export async function adminLogin(email, { fresh = false } = {}) {
  // One verified session per admin per test file (codes can't be reused, so a
  // second sign-in would have to wait for the next 30-second code).
  if (!fresh && adminClients.has(email)) return adminClients.get(email)
  const c = await login(email)
  const u = await db.user.findUnique({ where: { email }, select: { totpEnabledAt: true, id: true } })
  let secret = adminSecrets.get(email)
  if (u.totpEnabledAt && !secret) {
    // Set up by another test file (separate process): start this admin over.
    await db.user.update({ where: { id: u.id }, data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryHashes: [] } })
    u.totpEnabledAt = null
  }
  if (!u.totpEnabledAt) {
    const s = await c.post('/api/admin/2fa/setup')
    secret = s.json.secret.replace(/\s/g, '')
    adminSecrets.set(email, secret)
  }
  // Use a step no earlier code used, so back-to-back sign-ins never replay one.
  const last = (await db.user.findUnique({ where: { email }, select: { totpLastStep: true } })).totpLastStep
  const step = Math.max(currentStep(), (last ?? 0) + 1)
  if (step > currentStep() + 1) await new Promise((r) => setTimeout(r, (step - currentStep() - 1) * 30000 + 1000))
  const v = await c.post('/api/admin/2fa/verify', { code: totp(secret, step) })
  if (!v.json?.ticket) throw new Error(`admin 2FA failed: ${v.status} ${v.text}`)
  await c.updateSession({ mfaTicket: v.json.ticket })
  adminClients.set(email, c)
  return c
}
const adminSecrets = new Map()
const adminClients = new Map()

// ── TOTP (matches lib/admin-mfa.ts) ──────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function b32d(s) {
  let bits = 0, v = 0
  const out = []
  for (const ch of s.replace(/[^A-Z2-7]/g, '')) {
    v = (v << 5) | B32.indexOf(ch); bits += 5
    if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}
export function currentStep() { return Math.floor(Date.now() / 30000) }
export function totp(secret, step = currentStep()) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step))
  const h = crypto.createHmac('sha1', b32d(secret)).update(c).digest()
  const o = h[h.length - 1] & 15
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0')
}

// ── Misc ─────────────────────────────────────────────────────────────────────
/** Server log text (emails are logged there when no provider is configured). */
export function serverLog() {
  return SERVER_LOG && fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, 'utf8') : ''
}

/** A small JPEG made with sharp (already a dependency). */
export async function jpeg(w = 900, h = 1200, rgb = { r: 180, g: 120, b: 90 }) {
  const sharp = (await import('sharp')).default
  return { name: 'photo.jpg', type: 'image/jpeg', data: await sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).jpeg().toBuffer() }
}

export async function runLifecycle() {
  const res = await fetch(BASE + '/api/cron/lifecycle', { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } })
  return res.json()
}

export const strip = (html) => html.replace(/<!-- -->/g, '')
