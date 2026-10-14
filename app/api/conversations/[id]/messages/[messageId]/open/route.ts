import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getConversationAccess } from '@/lib/couples'
import { isValidId } from '@/lib/security'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import {
  PHOTO_VIEW_SEC,
  scheduleViewOnceSweep,
  viewOnceKindOf,
  viewOnceMediaUrlOf,
  viewWindowSec,
} from '@/lib/view-once'

export const runtime = 'nodejs'

/**
 * POST /api/conversations/<id>/messages/<messageId>/open
 *
 * Opens a view-once photo/video for the caller — once. Creates the caller's
 * MessageView with a short window (photo 15 s; video its length + 15 s,
 * max 3.5 min) during which /api/media/<id> serves the file to them only.
 *
 * 200 → { mediaUrl, kind: 'photo'|'video', durationSec, viewSec, openUntil }
 * 403 not a participant / sender / blocked · 404 not a view-once message
 * 410 { error, state: 'opened'|'expired' } already opened, or expired / deleted
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: conversationId, messageId } = await params
    if (!isValidId(conversationId) || !isValidId(messageId)) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (!rateLimit(`viewonce-open:${userId}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const access = await getConversationAccess(conversationId, userId)
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (access.blocked) return NextResponse.json({ error: 'You can no longer view messages in this conversation' }, { status: 403 })

    const msg = await db.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true, senderId: true, kind: true, imageUrl: true, meta: true, viewOnce: true, viewOnceExpiresAt: true, mediaDeletedAt: true },
    })
    if (!msg || !msg.viewOnce) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    if (msg.senderId === userId) {
      return NextResponse.json({ error: 'View-once media can only be opened by the people you sent it to' }, { status: 403 })
    }

    const existing = await db.messageView.findUnique({
      where: { messageId_userId: { messageId, userId } },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ error: 'Already opened', state: 'opened' }, { status: 410 })

    const now = Date.now()
    if (msg.mediaDeletedAt || (msg.viewOnceExpiresAt && msg.viewOnceExpiresAt.getTime() < now)) {
      return NextResponse.json({ error: 'This view-once message has expired', state: 'expired' }, { status: 410 })
    }

    const url = viewOnceMediaUrlOf(msg)
    if (!url) return NextResponse.json({ error: 'This view-once message has expired', state: 'expired' }, { status: 410 })

    const kind = viewOnceKindOf(msg)
    const meta = msg.meta && typeof msg.meta === 'object' && !Array.isArray(msg.meta) ? (msg.meta as Record<string, unknown>) : {}
    const durationSec = kind === 'video' && typeof meta.durationSec === 'number' ? meta.durationSec : null
    const windowSec = viewWindowSec(kind, durationSec)
    const openUntil = new Date(now + windowSec * 1000)

    try {
      await db.messageView.create({ data: { messageId, userId, openUntil, viewedAt: new Date(now) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'Already opened', state: 'opened' }, { status: 410 })
      }
      throw e
    }

    // Live "Opened" on the sender's bubble (streams react to updatedAt)
    await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }).catch(() => {})
    // When the window ends, delete the file if everyone has now seen it
    scheduleViewOnceSweep(conversationId, windowSec * 1000 + 2000)

    // A fresh query string so no cache (browser, proxy, SW) can ever hold or reuse the file
    const mediaUrl = `${url}?vo=${crypto.randomBytes(9).toString('base64url')}`
    return NextResponse.json(
      { mediaUrl, kind, durationSec, viewSec: kind === 'photo' ? PHOTO_VIEW_SEC : null, openUntil: openUntil.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('POST /api/conversations/[id]/messages/[messageId]/open error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
