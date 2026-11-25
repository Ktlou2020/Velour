// Real-browser checks of the screens people tap through (Chromium, phone size).
// Locally: E2E_CHROMIUM=/path/to/chromium; CI installs Playwright's Chromium.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, devices } from 'playwright-core'
import { BASE, PASSWORD, db, jpeg, makeUser, matchAndChat, rid } from './helpers.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const r = rid()
let browser
before(async () => { browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined }) })
after(async () => { await browser?.close() })

async function phone(email, { device = 'iPhone 13', userAgent, quiet = true } = {}) {
  const ctx = await browser.newContext({ ...devices[device], ...(userAgent ? { userAgent } : {}) })
  await ctx.addInitScript((q) => {
    localStorage.setItem('velour_age_verified', 'true')
    localStorage.setItem('velour_cookie_consent', 'accepted')
    if (q) { localStorage.setItem('unbound_pwa_dismissed_at', String(Date.now())); localStorage.setItem('unbound_reply_nudge_dismissed_at', String(Date.now())) }
  }, quiet)
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(BASE + '/auth/signin')
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', PASSWORD)
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/auth/signin')), p.click('button[type=submit]')])
  return { ctx, p, errors }
}

test('View once: toggle appears with a photo; receiver gets a sealed bubble', async () => {
  const amy = await makeUser(`ba${r}`, { profile: { membershipTier: 'PLATINUM' } })
  const ben = await makeUser(`bb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  await matchAndChat(amy, ben)
  const img = await jpeg()
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-img-')), img.name)
  fs.writeFileSync(file, img.data)
  const a = await phone(amy.email)
  await a.p.goto(BASE + '/messages'); await a.p.getByText(ben.username).first().click(); await a.p.waitForSelector('textarea')
  await a.p.setInputFiles('input[type=file][accept*="image"]', file)
  const toggle = a.p.getByRole('button', { name: /view once/i })
  await toggle.waitFor({ timeout: 15000 })
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
  await a.p.getByRole('button', { name: 'Send message' }).click()
  await a.p.waitForTimeout(2000)
  const b = await phone(ben.email)
  await b.p.goto(BASE + '/messages'); await b.p.getByText(amy.username).first().click()
  await b.p.getByText('Tap to open').waitFor({ timeout: 10000 })
  assert.deepEqual([...a.errors, ...b.errors], [])
  await a.ctx.close(); await b.ctx.close()
})

test('install prompt: Android steps after a page change; iPhone Share steps', async () => {
  const u = await makeUser(`bi${r}`)
  const sheet = (p) => p.locator('[data-testid=install-sheet]')
  const go = async (p) => { await p.locator('nav[aria-label="Primary"] a[href="/matches"]').click(); await p.waitForURL('**/matches'); await p.waitForTimeout(3800) }
  const android = await phone(u.email, { device: 'Pixel 7', quiet: false })
  await android.p.goto(BASE + '/members'); await android.p.waitForTimeout(3800)
  assert.equal(await sheet(android.p).isVisible(), false, 'not on the first page view')
  await go(android.p)
  assert.match(await sheet(android.p).innerText(), /Install app/)
  await android.ctx.close()
  const ios = await phone(u.email, { quiet: false })
  await go(ios.p)
  assert.match(await sheet(ios.p).innerText(), /Add to Home Screen/)
  await ios.ctx.close()
})

test('Gallery: open a photo, post a comment, see it', async () => {
  const owner = await makeUser(`bg${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const viewer = await makeUser(`bv${r}`)
  const up = await db.photo.create({ data: { userId: owner.id, url: '/api/media/e2e-missing', isPrivate: false } })
  const v = await phone(viewer.email)
  await v.p.goto(BASE + '/gallery/explore')
  await v.p.locator('article button').first().click()
  await v.p.getByText('Add a comment…').click()
  await v.p.fill('[data-testid=comments-sheet] textarea', 'Gorgeous!')
  await v.p.getByRole('button', { name: 'Post comment' }).click()
  await v.p.locator('[data-testid=comments-sheet] [data-comment] p', { hasText: 'Gorgeous!' }).waitFor({ timeout: 8000 })
  assert.equal(await db.photoComment.count({ where: { photoId: up.id } }), 1)
  await v.ctx.close()
})

test('admin two-step screen: setup shows a QR code and backup codes', async () => {
  const a = await makeUser(`bad${r}`, { user: { role: 'ADMIN' } })
  const s = await phone(a.email, { device: 'Desktop Chrome' })
  await s.p.goto(BASE + '/admin')
  assert.match(s.p.url(), /\/auth\/admin-verify/)
  await s.p.locator('[data-testid=totp-key]').waitFor()
  const { totp } = await import('./helpers.mjs')
  const key = (await s.p.textContent('[data-testid=totp-key]')).replace(/\s/g, '')
  await s.p.fill('#mfa-code', totp(key))
  await s.p.click('button[type=submit]')
  await s.p.locator('[data-testid=backup-codes]').waitFor()
  await s.p.check('input[type=checkbox]')
  await s.p.getByText('Continue to admin').click()
  await s.p.waitForURL('**/admin')
  await s.ctx.close()
})
