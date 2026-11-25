// Admin two-step login, new-device alerts, admin team, and admin-only access.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, adminLogin, currentStep, db, ensureBoss, login, makeUser, rid, serverLog, totp } from './helpers.mjs'

const r = rid()
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'

test('admins are normal members until they enter their code', async () => {
  const a = await makeUser(`ad${r}`, { user: { role: 'ADMIN' } })
  const c = await login(a.email)
  const s = await c.session()
  assert.equal(s.user.role, 'USER'); assert.equal(s.user.adminPending, true)
  assert.equal((await c.get('/api/admin/reports')).status, 403)
  assert.match((await c.get('/admin')).url, /\/auth\/admin-verify\?next=%2Fadmin/)
})

test('setup: QR secret → code → 10 backup codes; secret encrypted, codes hashed, audited', async () => {
  const a = await makeUser(`as${r}`, { user: { role: 'ADMIN' } })
  const c = await login(a.email)
  assert.equal((await c.get('/api/admin/2fa')).json.enabled, false)
  const setup = (await c.post('/api/admin/2fa/setup')).json
  assert.match(setup.qrSvg, /<svg/)
  const secret = setup.secret.replace(/\s/g, '')
  assert.equal((await c.post('/api/admin/2fa/verify', { code: '000000' })).status, 400)
  const code = totp(secret)
  const v = await c.post('/api/admin/2fa/verify', { code })
  assert.equal(v.status, 200, v.text)
  assert.equal(v.json.recoveryCodes.length, 10)
  const row = await db.user.findUnique({ where: { id: a.id } })
  assert.ok(row.totpSecret.startsWith('v1.') && !row.totpSecret.includes(secret))
  assert.ok(!row.totpRecoveryHashes.includes(v.json.recoveryCodes[0]))
  await c.updateSession({ mfaTicket: v.json.ticket })
  const s = await c.session()
  assert.equal(s.user.role, 'ADMIN'); assert.ok(!s.user.adminPending)
  assert.equal((await c.get('/api/admin/reports')).status, 200)
  assert.ok(await db.adminAuditLog.findFirst({ where: { action: 'ADMIN_2FA_ENABLED', actorId: a.id } }))

  // A new sign-in: the same code can't be replayed; the next one works.
  const c2 = await login(a.email)
  const replay = await c2.post('/api/admin/2fa/verify', { code })
  assert.equal(replay.status, 400); assert.match(replay.json.error, /already used/)
  const next = await c2.post('/api/admin/2fa/verify', { code: totp(secret, currentStep() + 1) })
  assert.equal(next.status, 200, next.text)

  // Backup code works once.
  const c3 = await login(a.email)
  assert.equal((await c3.post('/api/admin/2fa/verify', { code: v.json.recoveryCodes[0] })).status, 200)
  assert.equal((await c3.post('/api/admin/2fa/verify', { code: v.json.recoveryCodes[0] })).status, 400)
  assert.equal((await db.user.findUnique({ where: { id: a.id } })).totpRecoveryHashes.length, 9)
})

test('a made-up ticket does nothing; members can’t reach the 2FA API', async () => {
  const a = await makeUser(`af${r}`, { user: { role: 'ADMIN' } })
  const c = await login(a.email)
  await c.updateSession({ mfaTicket: 'x'.repeat(32) })
  assert.equal((await c.session()).user.adminPending, true)
  const m = await login((await makeUser(`am${r}`)).email)
  assert.equal((await m.get('/api/admin/2fa')).status, 403)
  assert.equal((await m.post('/api/admin/2fa/setup')).status, 403)
})

test('new-device sign-in email for admins (once per device)', async () => {
  const a = await makeUser(`an${r}`, { user: { role: 'ADMIN' } })
  const before = (serverLog().match(/New sign-in to your Unbound admin account/g) || []).length
  await login(a.email)
  await new Promise((res) => setTimeout(res, 500))
  const one = (serverLog().match(/New sign-in to your Unbound admin account/g) || []).length
  assert.equal(one, before + 1)
  await login(a.email)
  await new Promise((res) => setTimeout(res, 500))
  assert.equal((serverLog().match(/New sign-in to your Unbound admin account/g) || []).length, one, 'same device: no email')
  const phone = new Client()
  const csrf = (await phone.get('/api/auth/csrf', { headers: { 'user-agent': UA_PHONE } })).json.csrfToken
  await phone.req('/api/auth/callback/credentials', { method: 'POST', form: { email: a.email, password: 'Passw0rd!x', csrfToken: csrf, json: 'true' }, headers: { 'user-agent': UA_PHONE }, redirect: 'manual' })
  await new Promise((res) => setTimeout(res, 500))
  assert.equal((serverLog().match(/New sign-in to your Unbound admin account/g) || []).length, one + 1, 'new device: email')
})

test('super admin resets another admin’s two-step; normal admins can’t', async () => {
  const boss = await ensureBoss()
  const a = await makeUser(`ar${r}`, { user: { role: 'ADMIN' } })
  const other = await adminLogin(a.email)
  const bc = await adminLogin(boss.email)
  assert.equal((await other.post('/api/admin/2fa/reset', { userId: boss.id })).status, 403)
  const team = (await bc.get('/api/admin/team')).json
  assert.equal(team.admins.find((x) => x.id === a.id).twoStep, true)
  assert.equal((await bc.post('/api/admin/2fa/reset', { userId: a.id })).status, 200)
  assert.equal((await db.user.findUnique({ where: { id: a.id } })).totpEnabledAt, null)
  assert.ok(await db.adminAuditLog.findFirst({ where: { action: 'ADMIN_2FA_RESET', targetId: a.id } }))
})

test('admin pages and APIs are closed to members', async () => {
  const m = await login((await makeUser(`ax${r}`)).email)
  for (const p of ['/admin', '/admin/reports', '/admin/photos', '/admin/verification', '/admin/messages', '/admin/support', '/admin/health', '/admin/team']) {
    assert.doesNotMatch((await m.get(p)).url, /\/admin/, p)
  }
  for (const p of ['/api/admin/reports', '/api/admin/photos', '/api/admin/verification', '/api/admin/team', '/api/admin/support']) {
    assert.equal((await m.get(p)).status, 403, p)
  }
})
