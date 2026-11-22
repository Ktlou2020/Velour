import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'
import { FLAG_ORDER } from '@/lib/message-screen'

/**
 * Admin message review. Every admin can search members, list a member's
 * conversations (names and dates only) and the flagged-message queue.
 * Opening a conversation's messages needs a written reason and is logged
 * (POST /api/admin/messages/conversation). The access log is super-admin only.
 *
 * GET ?view=flags                         → unreviewed flagged messages
 * GET ?view=search&q=                     → members matching q
 * GET ?view=inbox&userId=                 → that member's conversations (no message text)
 * GET ?view=log                           → who opened which conversation, and why (super admin)
 */
export async function GET(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const view = sp.get('view')

  if (view === 'flags') {
    const flags = await db.messageFlag.findMany({
      where: { reviewedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, conversationId: true, senderId: true, categories: true, excerpt: true, createdAt: true },
    })
    const senders = await people(flags.map((f) => f.senderId))
    const rank = (c: string[]) => Math.min(...c.map((x) => FLAG_ORDER.indexOf(x as never)).filter((i) => i >= 0), 99)
    flags.sort((a, b) => rank(a.categories) - rank(b.categories) || b.createdAt.getTime() - a.createdAt.getTime())
    return NextResponse.json({ flags: flags.map((f) => ({ ...f, sender: senders.get(f.senderId) ?? null })) })
  }

  if (view === 'search') {
    const q = (sp.get('q') ?? '').trim().slice(0, 60)
    if (q.length < 2) return NextResponse.json({ members: [] })
    const users = await db.user.findMany({
      where: {
        isDemo: false,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { profile: { displayName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, isActive: true,
        profile: { select: { displayName: true } },
        _count: { select: { conversations: true, messagesSent: true } },
      },
    })
    const flagged = await db.messageFlag.groupBy({ by: ['senderId'], where: { senderId: { in: users.map((u) => u.id) } }, _count: { _all: true } })
    const fc = new Map(flagged.map((f) => [f.senderId, f._count._all]))
    return NextResponse.json({
      members: users.map((u) => ({
        id: u.id, username: u.username, email: u.email, isActive: u.isActive,
        displayName: u.profile?.displayName ?? null,
        conversations: u._count.conversations, messagesSent: u._count.messagesSent,
        flagged: fc.get(u.id) ?? 0,
      })),
    })
  }

  if (view === 'inbox') {
    const userId = sp.get('userId')
    if (!isValidId(userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const convs = await db.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      take: 100,
      select: {
        id: true, lastMessageAt: true, createdAt: true,
        participants: { select: { userId: true } },
        _count: { select: { messages: true } },
      },
    })
    const ids = [...new Set(convs.flatMap((c) => c.participants.map((p) => p.userId)))]
    const names = await people(ids)
    const flags = await db.messageFlag.groupBy({ by: ['conversationId'], where: { conversationId: { in: convs.map((c) => c.id) } }, _count: { _all: true } })
    const fc = new Map(flags.map((f) => [f.conversationId, f._count._all]))
    return NextResponse.json({
      conversations: convs.map((c) => ({
        id: c.id,
        lastMessageAt: c.lastMessageAt ?? c.createdAt,
        messages: c._count.messages,
        flagged: fc.get(c.id) ?? 0,
        with: c.participants.filter((p) => p.userId !== userId).map((p) => names.get(p.userId) ?? { id: p.userId, username: 'deleted', displayName: null }),
      })),
    })
  }

  if (view === 'log') {
    if (!me.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const logs = await db.adminAuditLog.findMany({
      where: { action: { in: ['MESSAGES_VIEWED', 'MESSAGE_FLAG_REVIEWED'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    const names = await people(logs.map((l) => l.actorId))
    return NextResponse.json({
      log: logs.map((l) => ({
        id: l.id, action: l.action, createdAt: l.createdAt,
        actor: names.get(l.actorId)?.username ?? 'unknown',
        meta: l.meta,
      })),
    })
  }

  return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
}

/** POST { flagId, action: 'reviewed' } → clears a flag from the queue (logged). */
export async function POST(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { flagId?: unknown; action?: unknown }
  if (!isValidId(body.flagId) || body.action !== 'reviewed') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const flag = await db.messageFlag.findUnique({ where: { id: body.flagId }, select: { id: true, conversationId: true, senderId: true, reviewedAt: true } })
  if (!flag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!flag.reviewedAt) {
    await db.messageFlag.update({ where: { id: flag.id }, data: { reviewedAt: new Date(), reviewedById: me.id } })
    await audit(me.id, 'MESSAGE_FLAG_REVIEWED', flag.senderId, { flagId: flag.id, conversationId: flag.conversationId })
  }
  return NextResponse.json({ ok: true })
}

async function people(ids: string[]) {
  const unique = [...new Set(ids)]
  const rows = unique.length
    ? await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, username: true, profile: { select: { displayName: true } } } })
    : []
  return new Map(rows.map((u) => [u.id, { id: u.id, username: u.username, displayName: u.profile?.displayName ?? null }]))
}
