// Photo verification (selfie + pose), photo review, reports dashboard,
// automatic protection (hidden pending review, new-account limits),
// verified filter, photo sizes, and the System health page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminLogin, db, ensureBoss, jpeg, login, makeUser, matchAndChat, rid, strip } from './helpers.mjs'

const r = rid()

test('verification: private selfie with a pose → admin approves or rejects with a note', async () => {
  const boss = await ensureBoss()
  const amy = await makeUser(`vamy${r}`)
  const ben = await makeUser(`vben${r}`)
  const ca = await login(amy.email), cb = await login(ben.email), adm = await adminLogin(boss.email)
  const g = (await ca.get('/api/verify')).json
  assert.equal(g.status, 'NONE'); assert.ok(g.pose)
  const up = await ca.upload({ purpose: 'verification' }, await jpeg())
  assert.equal(up.status, 201, JSON.stringify(up.json))
  assert.ok([403, 404].includes((await cb.get(up.json.url)).status), 'other members can’t see the selfie')
  assert.equal((await adm.get(up.json.url + '?size=medium')).status, 200, 'admins can')
  assert.equal((await ca.post('/api/verify', { photoUrl: up.json.url, pose: 'Do a backflip' })).status, 400)
  assert.equal((await cb.post('/api/verify', { photoUrl: up.json.url, pose: g.pose })).status, 400, 'can’t use someone else’s photo')
  assert.equal((await ca.post('/api/verify', { photoUrl: up.json.url, pose: g.pose })).status, 200)
  const reqs = (await adm.get('/api/admin/verification')).json.requests
  const mine = reqs.find((x) => x.user.username === amy.username)
  assert.equal(mine.pose, g.pose)
  assert.equal((await adm.patch('/api/admin/verification', { requestId: mine.id, action: 'reject' })).status, 400, 'reject needs a note')
  assert.equal((await adm.patch('/api/admin/verification', { requestId: mine.id, action: 'reject', notes: 'Face not visible' })).status, 200)
  const after = (await ca.get('/api/verify')).json
  assert.equal(after.status, 'REJECTED'); assert.equal(after.notes, 'Face not visible')
  const up2 = await ca.upload({ purpose: 'verification' }, await jpeg())
  await ca.post('/api/verify', { photoUrl: up2.json.url, pose: after.pose })
  const id2 = (await adm.get('/api/admin/verification')).json.requests.find((x) => x.user.username === amy.username).id
  assert.equal((await adm.patch('/api/admin/verification', { requestId: id2, action: 'approve' })).status, 200)
  assert.equal((await db.user.findUnique({ where: { id: amy.id } })).isVerified, true)
  assert.equal((await cb.get('/api/admin/verification')).status, 403)
})

test('verified-only filter works on the free plan', async () => {
  const v = await makeUser(`vv${r}`, { user: { isVerified: true } })
  const viewer = await makeUser(`vw${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const names = (await (await login(viewer.email)).get('/api/members?limit=100&verified=1')).json.members.map((m) => m.username)
  assert.ok(names.includes(v.username))
  assert.ok(names.every((n) => n !== `vw${r}`))
  const all = await db.user.findMany({ where: { username: { in: names } }, select: { isVerified: true } })
  assert.ok(all.every((u) => u.isVerified))
})

test('photos come in thumb < medium ≤ full sizes', async () => {
  const u = await makeUser(`ph${r}`), v = await makeUser(`pv${r}`)
  const c = await login(u.email)
  const up = await c.upload({ purpose: 'gallery' }, await jpeg(2400, 3000))
  await c.post('/api/photos', { url: up.json.url })
  const viewer = await login(v.email)
  const [full, med, th] = await Promise.all(['', '?size=medium', '?size=thumb'].map((q) => viewer.get(up.json.url + q)))
  assert.ok(full.status === 200 && med.status === 200 && th.status === 200)
  assert.ok(th.buf.length < med.buf.length && med.buf.length <= full.buf.length, `${th.buf.length} ${med.buf.length} ${full.buf.length}`)
})

test('photo review: new public photos queue; removal tells the member why', async () => {
  const boss = await ensureBoss()
  const u = await makeUser(`pr${r}`)
  const c = await login(u.email), adm = await adminLogin(boss.email)
  const up = await c.upload({ purpose: 'gallery' }, await jpeg())
  await c.post('/api/photos', { url: up.json.url })
  const q = (await adm.get('/api/admin/photos')).json
  const p = q.photos.find((x) => x.user.username === u.username)
  assert.ok(p, 'photo is queued')
  assert.equal((await c.get('/api/admin/photos')).status, 403)
  assert.equal((await adm.post('/api/admin/photos', { action: 'remove', photoId: p.id, reason: q.reasons[0] })).status, 200)
  assert.ok(await db.notification.findFirst({ where: { userId: u.id, type: 'SYSTEM' } }))
  assert.equal(await db.photo.count({ where: { id: p.id } }), 0)
})

test('reports dashboard: names, overdue, any admin can resolve, audited', async () => {
  const boss = await ensureBoss()
  const second = await makeUser(`adm2${r}`, { user: { role: 'ADMIN' } })
  const a = await makeUser(`rpa${r}`), b = await makeUser(`rpb${r}`)
  await (await login(a.email)).post('/api/reports', { targetUsername: b.username, reason: 'Spam or scam' })
  await db.notification.updateMany({ where: { type: 'REPORT', data: { path: ['reportedUserId'], equals: b.id } }, data: { createdAt: new Date(Date.now() - 30 * 3600000) } })
  const adm = await adminLogin(boss.email)
  const page = strip((await adm.get('/admin/reports')).text)
  assert.ok(page.includes(`@${a.username}`) && page.includes(`@${b.username}`) && page.includes('Overdue'))
  const stats = (await adm.get('/api/admin/reports')).json
  assert.ok(stats.overdue >= 1)
  const rep = await db.notification.findFirst({ where: { type: 'REPORT', data: { path: ['reportedUserId'], equals: b.id } } })
  const adm2 = await adminLogin(second.email)
  assert.equal((await adm2.patch('/api/admin/reports', { reportId: rep.id })).status, 200, 'a second admin can resolve')
  assert.ok(await db.adminAuditLog.findFirst({ where: { action: 'REPORT_RESOLVED', targetId: b.id } }))
})

test('3 different reporters hide a member pending review; admin restores', async () => {
  const boss = await ensureBoss()
  const scam = await makeUser(`sc${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const viewer = await makeUser(`sv${r}`)
  const vc = await login(viewer.email)
  const visible = async () => (await vc.get('/api/members?limit=200')).json.members.some((m) => m.username === scam.username)
  assert.ok(await visible())
  const reporters = await Promise.all([1, 2, 3].map((i) => makeUser(`sr${i}${r}`)))
  const rc = await Promise.all(reporters.map((u) => login(u.email)))
  await rc[0].post('/api/reports', { targetUsername: scam.username, reason: 'Spam or scam' })
  await rc[0].post('/api/reports', { targetUsername: scam.username, reason: 'Spam or scam' })
  await rc[1].post('/api/reports', { targetUsername: scam.username, reason: 'Spam or scam' })
  assert.ok(await visible(), 'two reporters (one twice) isn’t enough')
  await rc[2].post('/api/reports', { targetUsername: scam.username, reason: 'Harassment or abuse' })
  assert.equal((await db.user.findUnique({ where: { id: scam.id } })).underReviewReason, 'Reported by 3 different members')
  assert.ok(!(await visible()))
  assert.match((await vc.get(`/members/${scam.username}`)).text, /Member not found/)
  const sc = await login(scam.email)
  assert.equal((await sc.post('/api/conversations', { targetUsername: viewer.username })).json.code, 'UNDER_REVIEW')
  assert.equal((await vc.post('/api/conversations', { targetUsername: scam.username })).status, 403)
  const adm = await adminLogin(boss.email)
  assert.ok(strip((await adm.get('/admin/reports')).text).includes('Hidden pending review'))
  assert.equal((await vc.patch('/api/admin/reports', { action: 'restore', userId: scam.id })).status, 403)
  assert.equal((await adm.patch('/api/admin/reports', { action: 'restore', userId: scam.id })).status, 200)
  assert.ok(await visible())
  assert.ok(await db.adminAuditLog.findFirst({ where: { action: 'REVIEW_RESTORED', targetId: scam.id } }))
})

test('new accounts: 12 new people an hour, then “slow down” + one automatic flag', async () => {
  await ensureBoss()
  const nb = await makeUser(`nb${r}`, { user: { createdAt: new Date() }, profile: { gender: 'MAN', interestedIn: ['WOMAN'], membershipTier: 'PLATINUM' } })
  const targets = await Promise.all(Array.from({ length: 14 }, (_, i) => makeUser(`nt${i}${r}`)))
  const c = await login(nb.email)
  const codes = []
  let firstConv
  for (const t of targets) {
    const conv = await matchAndChat(nb, t)
    firstConv ??= conv.id
    codes.push((await c.post(`/api/conversations/${conv.id}/messages`, { content: 'hey' })).status)
  }
  assert.deepEqual(codes.slice(0, 12), Array(12).fill(201))
  assert.equal(codes[12], 429)
  assert.equal((await c.post(`/api/conversations/${firstConv}/messages`, { content: 'still chatting' })).status, 201, 'existing chats never limited')
  assert.equal(await db.notification.count({ where: { type: 'REPORT', AND: [{ data: { path: ['kind'], equals: 'AUTO' } }, { data: { path: ['reportedUserId'], equals: nb.id } }] } }), 1)
})

test('System health page lists every check (admins only)', async () => {
  const boss = await ensureBoss()
  const adm = await adminLogin(boss.email)
  const t = (await adm.get('/admin/health')).text
  for (const k of ['Email provider', 'SPF for', 'DKIM for', 'DMARC for', 'Error tracking (Sentry)', 'Phone alerts (web push)', 'Admin two-step login']) assert.ok(t.includes(k), k)
  const m = await makeUser(`hm${r}`)
  assert.doesNotMatch((await (await login(m.email)).get('/admin/health')).url, /\/admin\/health/)
})
