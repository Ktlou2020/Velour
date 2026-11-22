import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'

const PAGE = 50

/**
 * POST { reason, before? } → the newest messages across the site (super admin
 * only), with photos and videos (never view-once media). A reason (10+ chars)
 * is required; opening the feed is logged as LATEST_MESSAGES_VIEWED. `before`
 * (an ISO time) loads older messages under the same reason.
 */
export async function POST(req: NextRequest) {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { reason?: unknown; before?: unknown }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  if (reason.length < 10) return NextResponse.json({ error: 'Give a reason for viewing recent messages (at least 10 characters).' }, { status: 400 })
  const before = typeof body.before === 'string' && !Number.isNaN(Date.parse(body.before)) ? new Date(body.before) : null

  const rows = await db.message.findMany({
    where: before ? { createdAt: { lt: before } } : {},
    orderBy: { createdAt: 'desc' },
    take: PAGE,
    select: {
      id: true, conversationId: true, senderId: true, content: true, kind: true, imageUrl: true, audioUrl: true,
      viewOnce: true, meta: true, senderPartnerName: true, createdAt: true,
      flag: { select: { categories: true } },
      conversation: { select: { participants: { select: { userId: true } } } },
    },
  })
  if (!before) await audit(me.id, 'LATEST_MESSAGES_VIEWED', null, { reason })

  const ids = [...new Set(rows.flatMap((m) => [m.senderId, ...m.conversation.participants.map((p) => p.userId)]))]
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, profile: { select: { displayName: true } } } })
    : []
  const who = new Map(users.map((u) => [u.id, { id: u.id, username: u.username, displayName: u.profile?.displayName ?? null }]))

  return NextResponse.json({
    messages: rows.map((m) => {
      const videoUrl = !m.viewOnce && m.meta && typeof m.meta === 'object' && 'videoUrl' in m.meta ? String((m.meta as { videoUrl?: unknown }).videoUrl ?? '') || null : null
      return {
        id: m.id,
        conversationId: m.conversationId,
        createdAt: m.createdAt,
        from: who.get(m.senderId) ?? { id: m.senderId, username: 'deleted', displayName: null },
        fromPartner: m.senderPartnerName,
        to: m.conversation.participants.filter((p) => p.userId !== m.senderId).map((p) => who.get(p.userId) ?? { id: p.userId, username: 'deleted', displayName: null }),
        content: m.content,
        kind: m.kind,
        imageUrl: m.viewOnce ? null : m.imageUrl,
        videoUrl,
        hasAudio: !!m.audioUrl,
        viewOnce: m.viewOnce,
        flag: m.flag,
      }
    }),
    nextBefore: rows.length === PAGE ? rows[rows.length - 1].createdAt : null,
  })
}
