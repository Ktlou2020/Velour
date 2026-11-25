// Sign-up, one account per email, sign-in, and the "finish your profile" gate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, db, login, makeUser, rid } from './helpers.mjs'

const r = rid()

test('sign-up creates an account; the same inbox can’t sign up twice', async () => {
  const c = new Client()
  const email = `Jo.Ann+${r}@Gmail.com`
  const ok = await c.post('/api/register', { username: `jo${r}`, email, password: 'Str0ng!pass', dateOfBirth: '1992-05-05', accountType: 'SINGLE' })
  assert.ok([200, 201].includes(ok.status), ok.text)
  const stored = await db.user.findUnique({ where: { username: `jo${r}` }, select: { email: true } })
  assert.equal(stored.email, email.toLowerCase(), 'emails are stored lowercase')

  for (const variant of [`joann+other${r}@gmail.com`, `JO.ANN+${r}@googlemail.com`, email.toUpperCase()]) {
    const dup = await new Client().post('/api/register', { username: `x${rid(8)}`, email: variant, password: 'Str0ng!pass', dateOfBirth: '1992-05-05', accountType: 'SINGLE' })
    assert.equal(dup.status, 409, `${variant} should be refused: ${dup.text}`)
  }
})

test('sign-in ignores capital letters in the email', async () => {
  await makeUser(`cap${r}`)
  const c = await login(`CAP${r}@E2E.TEST`)
  assert.equal((await c.session())?.user?.username, `cap${r}`)
})

test('wrong password doesn’t sign in', async () => {
  await makeUser(`pw${r}`)
  const c = new Client()
  await c.login(`pw${r}@e2e.test`, 'nope-nope')
  assert.equal(await c.session(), null)
})

test('signed-out visitors are sent to sign in; public pages stay public', async () => {
  const c = new Client()
  assert.match((await c.get('/members')).url, /\/auth\/signin/)
  for (const p of ['/', '/help', '/help/contact', '/app', '/contact', '/privacy', '/terms']) {
    assert.equal((await c.get(p)).status, 200, p)
  }
})

test('members finish the basics and a photo before browsing or messaging', async () => {
  const u = await makeUser(`half${r}`, { profile: { profilePhoto: null } })
  const other = await makeUser(`full${r}`, { profile: { gender: 'MAN' } })
  const c = await login(u.email)
  assert.match((await c.get('/members')).url, /\/onboarding/)
  assert.equal((await c.get('/profile')).status, 200, 'profile stays reachable')
  const start = await c.post('/api/conversations', { targetUsername: other.username })
  assert.equal(start.status, 403)
  assert.equal(start.json.code, 'PROFILE_INCOMPLETE')
})

test('the logo/home link takes signed-in members to their feed', async () => {
  const u = await makeUser(`home${r}`)
  const c = await login(u.email)
  assert.match((await c.get('/')).url, /\/members$/)
})
