import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'

/**
 * POST { conversationId, reason } → the conversation's messages, read-only.
 * A reason (at least 10 characters) is required every time, and each opening
 * is written to the admin audit log with the reason and the participants.
 * View-once media is never shown.
 */
export async function POST(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { conversationId?: unknown; reason?: unknown }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  if (!isValidId(body.conversationId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reason.length < 10) return NextResponse.json({ error: 'Give a reason for opening this conversation (at least 10 characters).' }, { status: 400 })

  const conv = await db.conversation.findUnique({
    where: { id: body.conversationId },
    select: {
      id: true, createdAt: true,
      participants: { select: { user: { select: { id: true, username: true, profile: { select: { displayName: true } } } } } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 1000,
        select: {
          id: true, senderId: true, content: true, kind: true, imageUrl: true, audioUrl: true, viewOnce: true,
          senderPartnerName: true, createdAt: true, flag: { select: { categories: true, reviewedAt: true } },
        },
      },
    },
  })
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const participants = conv.participants.map((p) => ({ id: p.user.id, username: p.user.username, displayName: p.user.profile?.displayName ?? null }))
  await audit(me.id, 'MESSAGES_VIEWED', null, {
    conversationId: conv.id,
    reason,
    participants: participants.map((p) => p.username),
  })

  const names = new Map(participants.map((p) => [p.id, p.displayName || p.username]))
  return NextResponse.json({
    conversation: {
      id: conv.id,
      participants,
      messages: conv.messages.map((m) => ({
        id: m.id,
        sender: (names.get(m.senderId) ?? 'Former member') + (m.senderPartnerName ? ` (${m.senderPartnerName})` : ''),
        senderId: m.senderId,
        content: m.content,
        kind: m.kind,
        imageUrl: m.viewOnce ? null : m.imageUrl,
        hasAudio: !!m.audioUrl,
        viewOnce: m.viewOnce,
        createdAt: m.createdAt,
        flag: m.flag,
      })),
    },
  })
}
