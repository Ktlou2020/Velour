// The Gallery (likes + comments), lifecycle emails (match nudge, weekly new
// members), and the Help Centre / support inbox.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, adminLogin, db, ensureBoss, jpeg, login, makeUser, matchAndChat, rid, runLifecycle, serverLog, strip } from './helpers.mjs'

const r = rid()

async function publicPhoto(user) {
  const c = await login(user.email)
  const up = await c.upload({ purpose: 'gallery' }, await jpeg())
  await c.post('/api/photos', { url: up.json.url })
  return (await db.photo.findFirst({ where: { url: up.json.url } })).id
}

test('Gallery: newest first, likes and comments with notifications', async () => {
  const owner = await makeUser(`go${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const amy = await makeUser(`ga${r}`), carl = await makeUser(`gc${r}`)
  const pid = await publicPhoto(owner)
  const ca = await login(amy.email), cc = await login(carl.email), co = await login(owner.email)
  const feed = (await ca.get('/api/gallery')).json
  assert.equal(feed.photos[0].id, pid, 'newest photo first')
  assert.equal((await ca.post(`/api/photos/${pid}/like`, { like: true })).json.liked, true)
  assert.equal((await ca.post(`/api/photos/${pid}/comments`, { body: 'Love this shot!' })).status, 201)
  await cc.post(`/api/photos/${pid}/comments`, { body: 'Great light' })
  const n = await db.notification.findMany({ where: { userId: owner.id, type: 'PHOTO_COMMENT' } })
  assert.equal(n.length, 1, 'one notification per photo')
  assert.equal(n[0].title, `${carl.username} and 1 other commented on your photo`)
  assert.equal((await co.post(`/api/photos/${pid}/comments`, { body: 'Thanks both!' })).status, 201, 'owner can reply')
  assert.equal((await ca.get('/api/gallery')).json.photos.find((p) => p.id === pid).commentCount, 3)
  assert.equal((await ca.get('/gallery/explore')).status, 200)
})

test('Gallery comments: screened, length-limited, and members must finish their profile', async () => {
  const owner = await makeUser(`gs${r}`)
  const amy = await makeUser(`gsa${r}`), half = await makeUser(`gsh${r}`, { profile: { profilePhoto: null } })
  const pid = await publicPhoto(owner)
  const c = await login(amy.email)
  const phone = await c.post(`/api/photos/${pid}/comments`, { body: 'whatsapp me on 082 555 1234' })
  assert.equal(phone.status, 400); assert.match(phone.json.error, /private message/)
  assert.equal((await c.post(`/api/photos/${pid}/comments`, { body: 'my insta is @amy_xx' })).status, 400)
  assert.equal((await c.post(`/api/photos/${pid}/comments`, { body: '   ' })).status, 400)
  assert.equal((await c.post(`/api/photos/${pid}/comments`, { body: 'x'.repeat(501) })).status, 400)
  assert.equal((await (await login(half.email)).post(`/api/photos/${pid}/comments`, { body: 'hi' })).status, 403)
})

test('Gallery comments: blocks, delete rights, admin removal is audited, private photos', async () => {
  const boss = await ensureBoss()
  const owner = await makeUser(`gb${r}`), amy = await makeUser(`gba${r}`), carl = await makeUser(`gbc${r}`), eve = await makeUser(`gbe${r}`)
  const pid = await publicPhoto(owner)
  const [co, ca, cc, ce] = await Promise.all([owner, amy, carl, eve].map((u) => login(u.email)))
  await ca.post(`/api/photos/${pid}/comments`, { body: 'Amy here' })
  await cc.post(`/api/photos/${pid}/comments`, { body: 'Carl here' })
  await ca.post('/api/block', { userId: carl.id })
  const amySees = (await ca.get(`/api/photos/${pid}/comments`)).json.comments.map((c) => c.author.username)
  assert.ok(!amySees.includes(carl.username), 'blocked member’s comments hidden')
  const ids = Object.fromEntries((await ce.get(`/api/photos/${pid}/comments`)).json.comments.map((c) => [c.author.username, c.id]))
  assert.equal((await ce.del(`/api/photos/${pid}/comments/${ids[amy.username]}`)).status, 403, 'others can’t delete')
  assert.equal((await co.del(`/api/photos/${pid}/comments/${ids[carl.username]}`)).status, 200, 'owner deletes on their photo')
  assert.equal((await ca.del(`/api/photos/${pid}/comments/${ids[amy.username]}`)).status, 200, 'author deletes own')
  await ce.post(`/api/photos/${pid}/comments`, { body: 'Eve here' })
  const eid = (await co.get(`/api/photos/${pid}/comments`)).json.comments.find((c) => c.author.username === eve.username).id
  const adm = await adminLogin(boss.email)
  assert.equal((await adm.del(`/api/photos/${pid}/comments/${eid}`)).status, 200)
  assert.ok(await db.adminAuditLog.findFirst({ where: { action: 'PHOTO_COMMENT_REMOVED' } }))
  assert.equal((await db.photo.findUnique({ where: { id: pid } })).commentCount, 0, 'count stays correct')
  await db.photo.update({ where: { id: pid }, data: { isPrivate: true } })
  assert.equal((await ce.get(`/api/photos/${pid}/comments`)).status, 404)
})

test('match nudge: both people, only when nobody has written, only once', async () => {
  const a = await makeUser(`na${r}`), b = await makeUser(`nb${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const c = await makeUser(`nc${r}`), d = await makeUser(`nd${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'] } })
  const t = new Date(Date.now() - 30 * 3600000)
  await db.match.create({ data: { user1Id: a.id, user2Id: b.id, createdAt: t } })
  const conv = await matchAndChat(c, d)
  await db.match.updateMany({ where: { user1Id: c.id, user2Id: d.id }, data: { createdAt: t } })
  await db.message.create({ data: { conversationId: conv.id, senderId: c.id, content: 'hi' } })
  await runLifecycle()
  const nudged = (await db.emailLog.findMany({ where: { kind: 'MATCH_NUDGE', userId: { in: [a.id, b.id, c.id, d.id] } } })).map((e) => e.userId).sort()
  assert.deepEqual(nudged, [a.id, b.id].sort())
  assert.match(serverLog(), new RegExp(`Say hi to ${b.username}`))
  const again = await runLifecycle()
  assert.equal(again.kinds.MATCH_NUDGE.sent, 0)
})

test('weekly new members: only when 3+ people they’re interested in joined nearby', async () => {
  const city = `Town${r}`
  const away = await makeUser(`wa${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'], city, lastSeen: new Date(Date.now() - 10 * 86400000) } })
  const quiet = await makeUser(`wq${r}`, { profile: { gender: 'MAN', interestedIn: ['WOMAN'], city: `Else${r}`, lastSeen: new Date(Date.now() - 10 * 86400000) } })
  for (let i = 0; i < 4; i++) await makeUser(`wn${i}${r}`, { user: { createdAt: new Date(Date.now() - 2 * 86400000) }, profile: { city } })
  await makeUser(`wm${r}`, { user: { createdAt: new Date(Date.now() - 2 * 86400000) }, profile: { city, gender: 'MAN', interestedIn: ['WOMAN'] } })
  await runLifecycle()
  assert.equal(await db.emailLog.count({ where: { userId: away.id, kind: 'WEEKLY_NEW_MEMBERS' } }), 1)
  assert.match(serverLog(), /4 new members near you this week/)
  assert.equal((await db.emailLog.findFirst({ where: { userId: quiet.id } }))?.kind, 'WEEKLY_NEW_MEMBERS_NONE')
})

test('Help Centre + support tickets: visitors and members; admin replies', async () => {
  const boss = await ensureBoss()
  const m = await makeUser(`sp${r}`)
  assert.ok((await new Client().get('/help')).text.includes('What is the Gallery?'), 'Help Centre is public')
  const c = await login(m.email)
  const t = await c.post('/api/support', { category: 'ACCOUNT', subject: 'Cannot change city', message: 'I moved to Cape Town but it still says Durban.', email: 'someone-else@example.com' })
  assert.ok([200, 201].includes(t.status), t.text)
  const ticket = await db.supportTicket.findFirst({ where: { userId: m.id } })
  assert.equal(ticket.email, m.email, 'members always use their account email')
  assert.equal((await c.post('/api/support', { category: 'NOPE', subject: 'Hi there', message: 'Something longer here' })).status, 400)
  assert.equal((await c.get('/api/admin/support')).status, 403)
  const adm = await adminLogin(boss.email)
  const reply = await adm.patch(`/api/admin/support/${ticket.id}`, { action: 'reply', reply: 'Update it in Edit profile → Location.' })
  assert.equal(reply.status, 200, reply.text)
  assert.equal((await db.supportTicket.findUnique({ where: { id: ticket.id } })).status, 'ANSWERED')
  assert.equal((await adm.get('/admin/support')).status, 200)
  assert.ok(JSON.stringify((await adm.get('/api/admin/support?status=ALL')).json).includes('Cannot change city'))
})
