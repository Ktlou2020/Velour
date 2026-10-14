import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPaid } from '@/lib/premium'
import { normalizeReactions } from '@/lib/reactions'

export const dynamic = 'force-dynamic'

const POLL_MS = 1500

/**
 * SSE stream for one conversation. Emits:
 *  { type: 'connected' }
 *  { type: 'message', message }
 *  { type: 'typing', userId, isTyping }
 *  { type: 'read', messageIds, readAt }          (paid callers only)
 *  { type: 'reaction', messageId, reactions }
 *
 * Each poll does one light query (conversation.updatedAt + the other
 * participant's typingUntil). Messages / reads / reactions are only queried
 * when updatedAt changed — every write path touches the conversation.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = session.user.id
  const role = (session.user as { role?: string }).role

  const { id: conversationId } = await params

  // Verify participant
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, user: { select: { profile: { select: { membershipTier: true } } } } },
  })
  if (!participant) return new Response('Forbidden', { status: 403 })
  const paid = isPaid(participant.user.profile?.membershipTier, role)

  let lastMessageId: string | null = null
  let lastUpdatedAt = 0
  let readCursor = new Date()
  const typingState = new Map<string, boolean>()
  const reactionCache = new Map<string, string>()
  let closed = false
  let polling = false

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: unknown) => {
        if (!closed) {
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
          } catch { closed = true }
        }
      }

      // Send connected ping
      send({ type: 'connected' })

      // Seed state with the current latest
      const [latest, conv, reacted] = await Promise.all([
        db.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        }),
        db.conversation.findUnique({ where: { id: conversationId }, select: { updatedAt: true } }),
        db.message.findMany({
          where: { conversationId, reactions: { not: Prisma.AnyNull } },
          select: { id: true, reactions: true },
        }),
      ])
      lastMessageId = latest?.id ?? null
      lastUpdatedAt = conv?.updatedAt.getTime() ?? 0
      for (const r of reacted) reactionCache.set(r.id, JSON.stringify(normalizeReactions(r.reactions)))

      let ticks = 0
      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); return }
        if (polling) return // previous poll still running
        polling = true
        try {
          const now = Date.now()
          const conv = await db.conversation.findUnique({
            where: { id: conversationId },
            select: {
              updatedAt: true,
              participants: {
                where: { userId: { not: userId } },
                select: { userId: true, typingUntil: true },
              },
            },
          })
          if (!conv) { closed = true; clearInterval(poll); return }

          // ── Typing ────────────────────────────────────────────────────
          for (const p of conv.participants) {
            const isTyping = !!p.typingUntil && p.typingUntil.getTime() > now
            if ((typingState.get(p.userId) ?? false) !== isTyping) {
              typingState.set(p.userId, isTyping)
              send({ type: 'typing', userId: p.userId, isTyping })
            }
          }

          const updatedAt = conv.updatedAt.getTime()
          if (updatedAt !== lastUpdatedAt) {
            lastUpdatedAt = updatedAt

            const [newMessages, reads, reacted] = await Promise.all([
              db.message.findMany({
                where: {
                  conversationId,
                  ...(lastMessageId ? { id: { gt: lastMessageId } } : {}),
                },
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  content: true,
                  imageUrl: true,
                  senderId: true,
                  isRead: true,
                  readAt: true,
                  reactions: true,
                  createdAt: true,
                },
              }),
              paid
                ? db.message.findMany({
                    where: { conversationId, senderId: userId, readAt: { gt: readCursor } },
                    select: { id: true, readAt: true },
                  })
                : Promise.resolve([] as { id: string; readAt: Date | null }[]),
              db.message.findMany({
                where: { conversationId, reactions: { not: Prisma.AnyNull } },
                select: { id: true, reactions: true },
              }),
            ])

            // ── New messages ────────────────────────────────────────────
            const incomingIds: string[] = []
            for (const msg of newMessages) {
              const own = msg.senderId === userId
              send({
                type: 'message',
                message: own && !paid ? { ...msg, isRead: false, readAt: null } : msg,
              })
              lastMessageId = msg.id
              if (!own && !msg.isRead) incomingIds.push(msg.id)
              if (msg.reactions) reactionCache.set(msg.id, JSON.stringify(normalizeReactions(msg.reactions)))
            }

            // The viewer has this chat open → incoming messages are read now
            if (incomingIds.length > 0) {
              await db.$transaction([
                db.message.updateMany({
                  where: { id: { in: incomingIds }, isRead: false },
                  data: { isRead: true, readAt: new Date() },
                }),
                db.conversationParticipant.update({
                  where: { conversationId_userId: { conversationId, userId } },
                  data: { unreadCount: 0 },
                }),
                db.conversation.update({
                  where: { id: conversationId },
                  data: { updatedAt: new Date() },
                }),
              ])
            }

            // ── Read receipts ───────────────────────────────────────────
            if (reads.length > 0) {
              let max = readCursor
              for (const r of reads) if (r.readAt && r.readAt > max) max = r.readAt
              readCursor = max
              send({ type: 'read', messageIds: reads.map((r) => r.id), readAt: max })
            }

            // ── Reactions ───────────────────────────────────────────────
            const seen = new Set<string>()
            for (const r of reacted) {
              seen.add(r.id)
              const norm = normalizeReactions(r.reactions)
              const key = JSON.stringify(norm)
              if (reactionCache.get(r.id) !== key) {
                reactionCache.set(r.id, key)
                send({ type: 'reaction', messageId: r.id, reactions: norm })
              }
            }
            for (const id of Array.from(reactionCache.keys())) {
              if (!seen.has(id)) {
                reactionCache.delete(id)
                send({ type: 'reaction', messageId: id, reactions: {} })
              }
            }
          }

          // Keep-alive comment every ~15s so proxies don't drop the stream
          if (++ticks % 10 === 0 && !closed) {
            try { controller.enqueue(enc.encode(': ping\n\n')) } catch { closed = true }
          }
        } catch { clearInterval(poll); closed = true; try { controller.close() } catch { /* ignore */ } }
        finally { polling = false }
      }, POLL_MS)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(poll)
        try { controller.close() } catch { /* ignore */ }
      })
    },
    cancel() { closed = true },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
