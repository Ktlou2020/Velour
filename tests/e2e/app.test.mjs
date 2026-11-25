// The phone app: push alerts (real encrypted delivery to a local stand-in for
// the push service), test alerts, discreet alerts, install tracking, /app.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client, db, login, makeUser, matchAndChat, rid } from './helpers.mjs'

const r = rid()
const pushOn = !!process.env.VAPID_PUBLIC_KEY

// Stand-in push service: decrypts what web-push sends (aes128gcm).
const received = []
let server
async function startReceiver() {
  const ece = (await import('http_ece')).default
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-push-'))
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/k.pem`, '-out', `${dir}/c.pem`, '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' })
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys()
  const auth = crypto.randomBytes(16)
  server = https.createServer({ key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) }, (req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const out = ece.decrypt(Buffer.concat(chunks), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth.toString('base64url') })
        received.push(JSON.parse(out.toString()))
        res.writeHead(201)
      } catch { res.writeHead(400) }
      res.end()
    })
  })
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  return { endpoint: `https://127.0.0.1:${server.address().port}/push/${rid()}`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: auth.toString('base64url') } }
}
after(() => server?.close())
const wait = () => new Promise((ok) => setTimeout(ok, 1200))

test('phone alerts: test alert, message alert, discreet mode, turning off', { skip: !pushOn && 'VAPID keys not set' }, async () => {
  const sub = await startReceiver()
  const amy = await makeUser(`pa${r}`)
  const ben = await makeUser(`pb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'], membershipTier: 'PLATINUM' } })
  const conv = await matchAndChat(amy, ben)
  const ca = await login(amy.email), cb = await login(ben.email)
  assert.equal((await ca.get('/api/push')).json.enabled, true)
  assert.equal((await ca.post('/api/push', sub)).status, 200)
  assert.equal((await cb.post('/api/push/test', { endpoint: sub.endpoint })).status, 409, 'can’t test someone else’s device')
  assert.equal((await ca.post('/api/push/test', { endpoint: sub.endpoint })).status, 200)
  await wait()
  assert.ok(received.some((p) => p.tag === 'push-test'))
  await cb.post(`/api/conversations/${conv.id}/messages`, { content: 'Are you free Friday?' })
  await wait()
  let m = received.filter((p) => p.tag === `message-${conv.id}`).at(-1)
  assert.match(m.title, new RegExp(ben.username)); assert.match(m.body, /Friday/)
  assert.deepEqual((await ca.post('/api/settings/discreet-alerts', { discreet: true })).json, { discreet: true })
  await cb.post(`/api/conversations/${conv.id}/messages`, { content: 'Secret plans' })
  await wait()
  m = received.filter((p) => p.tag === `message-${conv.id}`).at(-1)
  assert.equal(m.title, 'Unbound'); assert.equal(m.body, 'You have a new notification')
  assert.ok(!JSON.stringify(m).includes('Secret'))
  assert.equal(m.url, `/messages?conv=${conv.id}`, 'still opens the chat')
  assert.equal((await ca.del('/api/push', { endpoint: sub.endpoint })).status, 200)
  const n = received.length
  await cb.post(`/api/conversations/${conv.id}/messages`, { content: 'hello?' })
  await wait()
  assert.equal(received.length, n, 'no alert after turning off')
})

test('discreet setting validates input', async () => {
  const c = await login((await makeUser(`dv${r}`)).email)
  assert.equal((await c.get('/api/settings/discreet-alerts')).json.discreet, false)
  assert.equal((await c.post('/api/settings/discreet-alerts', { discreet: 'yes' })).status, 400)
})

test('opening the home-screen app is counted for the admin dashboard', async () => {
  const u = await makeUser(`io${r}`)
  const c = await login(u.email)
  assert.equal((await c.post('/api/app/opened', { event: 'nope' })).status, 400)
  assert.equal((await c.post('/api/app/opened', { event: 'opened' })).status, 200)
  const p = await db.profile.findUnique({ where: { userId: u.id } })
  assert.ok(p.appInstalledAt && p.appLastOpenedAt)
  assert.equal((await new Client().post('/api/app/opened', { event: 'opened' })).status, 401)
})

test('/app page: QR code and steps; manifest shortcuts point at live pages', async () => {
  const page = (await new Client().get('/app')).text
  assert.match(page, /Get the Unbound app/)
  assert.match(page, /<svg[^>]*>/)
  const m = (await new Client().get('/manifest.json')).json
  const urls = m.shortcuts.map((s) => s.url.split('?')[0])
  assert.deepEqual(urls.sort(), ['/discover', '/gallery/explore', '/matches', '/messages'].sort())
})
