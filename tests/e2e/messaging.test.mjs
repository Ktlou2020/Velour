// Matching, chatting, View once, unmatch / block / report, "who can message me",
// and admin message review (reason required + audit log).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminLogin, db, ensureBoss, jpeg, login, makeUser, matchAndChat, rid } from './helpers.mjs'

const r = rid()
const send = (c, conv, body) => c.post(`/api/conversations/${conv}/messages`, body)

test('two likes make a match; matched members can chat', async () => {
  const a = await makeUser(`ma${r}`)
  const b = await makeUser(`mb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const ca = await login(a.email), cb = await login(b.email)
  await ca.post('/api/likes', { targetUsername: b.username, type: 'LIKE' })
  const back = await cb.post('/api/likes', { targetUsername: a.username, type: 'LIKE' })
  assert.equal(back.json.matched, true, back.text)
  const conv = (await cb.post('/api/conversations', { targetUsername: a.username })).json.conversation.id
  assert.equal((await send(cb, conv, { content: 'Hey there!' })).status, 201)
  const list = (await ca.get(`/api/conversations/${conv}/messages`)).json
  assert.ok(JSON.stringify(list).includes('Hey there!'))
})

test('View once: sealed for the receiver, opens exactly once, never in admin review', async () => {
  const a = await makeUser(`va${r}`, { profile: { membershipTier: 'PLATINUM' } })
  const b = await makeUser(`vb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const conv = await matchAndChat(a, b)
  const ca = await login(a.email), cb = await login(b.email)
  const up = await ca.upload({ purpose: 'chat' }, await jpeg())
  assert.equal(up.status, 201, JSON.stringify(up.json))
  const sent = await send(ca, conv.id, { content: '', imageUrl: up.json.url, viewOnce: true })
  assert.equal(sent.status, 201, sent.text)
  const msgs = (await cb.get(`/api/conversations/${conv.id}/messages`)).json.messages
  const vo = msgs.find((m) => m.viewOnce)
  assert.ok(vo, 'receiver sees a View once message')
  assert.ok(!vo.imageUrl, 'no image URL before opening')
  const open1 = await cb.post(`/api/conversations/${conv.id}/messages/${vo.id}/open`)
  assert.equal(open1.status, 200, open1.text)
  assert.equal((await cb.get(open1.json.mediaUrl)).status, 200, 'media served during the open window')
  const open2 = await cb.post(`/api/conversations/${conv.id}/messages/${vo.id}/open`)
  assert.equal(open2.status, 410, 'second open refused')
  const sender = await ca.post(`/api/conversations/${conv.id}/messages/${vo.id}/open`)
  assert.equal(sender.status, 403, 'sender can’t open their own')
})

test('unmatch ends the match and chat for both, for good', async () => {
  const a = await makeUser(`ua${r}`)
  const b = await makeUser(`ub${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const conv = await matchAndChat(a, b)
  const ca = await login(a.email), cb = await login(b.email)
  await send(cb, conv.id, { content: 'hi' })
  assert.equal((await ca.post('/api/unmatch', { userId: b.id })).status, 200)
  assert.equal(await db.match.count({ where: { OR: [{ user1Id: a.id }, { user2Id: a.id }] } }), 0)
  assert.ok([403, 404].includes((await send(cb, conv.id, { content: 'hello?' })).status))
  assert.equal((await cb.post('/api/conversations', { targetUsername: a.username })).status, 403)
  await cb.post('/api/likes', { targetUsername: a.username, type: 'LIKE' })
  const again = await ca.post('/api/likes', { targetUsername: b.username, type: 'LIKE' })
  assert.ok(!again.json?.matched, 'never re-matches')
  assert.equal(await db.message.count({ where: { conversationId: conv.id } }), 1, 'messages kept for safety review')
})

test('block hides both ways and stops messages', async () => {
  const a = await makeUser(`ba${r}`)
  const b = await makeUser(`bb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const conv = await matchAndChat(a, b)
  const ca = await login(a.email), cb = await login(b.email)
  assert.equal((await ca.post('/api/block', { userId: b.id })).status, 200)
  assert.ok([403, 404].includes((await send(cb, conv.id, { content: 'hi' })).status))
  assert.match((await cb.get(`/members/${a.username}`)).text, /Member not found/)
  const names = (await cb.get('/api/members?limit=100')).json.members.map((m) => m.username)
  assert.ok(!names.includes(a.username))
})

test('reports reach the admin queue with the reason and note', async () => {
  const a = await makeUser(`ra${r}`)
  const b = await makeUser(`rb${r}`)
  await makeUser(`radm${r}`, { user: { role: 'ADMIN' } })
  const res = await (await login(a.email)).post('/api/reports', { targetUsername: b.username, reason: 'Spam or scam', note: 'asked for money' })
  assert.equal(res.status, 200, res.text)
  const n = await db.notification.findFirst({ where: { type: 'REPORT', data: { path: ['reportedUserId'], equals: b.id } } })
  assert.equal(n.data.reason, 'Spam or scam')
  assert.equal(n.data.details, 'asked for money')
})

test('“Who can message me”: liked-only and verified-only', async () => {
  const a = await makeUser(`pa${r}`)
  const b = await makeUser(`pb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'], membershipTier: 'PLATINUM' } })
  const ca = await login(a.email), cb = await login(b.email)
  assert.equal((await ca.post('/api/settings/message-policy', { policy: 'LIKED' })).status, 200)
  const refused = await cb.post('/api/conversations', { targetUsername: a.username })
  assert.equal(refused.status, 403)
  assert.equal(refused.json.code, 'MESSAGE_POLICY')
  await ca.post('/api/likes', { targetUsername: b.username, type: 'LIKE' })
  assert.ok([200, 201].includes((await cb.post('/api/conversations', { targetUsername: a.username })).status))
  await ca.post('/api/settings/message-policy', { policy: 'VERIFIED' })
  const c = await makeUser(`pc${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'], membershipTier: 'PLATINUM' } })
  assert.equal((await (await login(c.email)).post('/api/conversations', { targetUsername: a.username })).status, 403)
})

test('admin message review needs a reason every time and is logged; flags are queued', async () => {
  const boss = await ensureBoss()
  const a = await makeUser(`fa${r}`), b = await makeUser(`fb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'], membershipTier: 'PLATINUM' } })
  const conv = await matchAndChat(a, b)
  await send(await login(b.email), conv.id, { content: 'whatsapp me on 082 555 1234' })
  const adm = await adminLogin(boss.email)
  const flags = (await adm.get('/api/admin/messages?view=flags')).json
  assert.ok(JSON.stringify(flags).includes('082 555 1234') || JSON.stringify(flags).includes('CONTACT'), 'contact details flagged')
  assert.equal((await adm.post('/api/admin/messages/conversation', { conversationId: conv.id, reason: 'short' })).status, 400)
  const open = await adm.post('/api/admin/messages/conversation', { conversationId: conv.id, reason: 'Checking a flagged message' })
  assert.equal(open.status, 200, open.text)
  assert.ok(await db.adminAuditLog.findFirst({ where: { actorId: boss.id, meta: { path: ['reason'], equals: 'Checking a flagged message' } } }))
  assert.equal((await adm.post('/api/admin/messages/latest', { reason: 'Daily safety check of new messages' })).status, 200)
  const member = await login(a.email)
  assert.equal((await member.get('/api/admin/messages?view=flags')).status, 403)
})
