import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPaid } from '@/lib/premium'
import { normalizeReactions } from '@/lib/reactions'
import { computeReceipt, getPartnerMap, getTypingAs, sideOf } from '@/lib/couples'
import { messageForViewer, redactGameMeta } from '@/lib/chat-games'

export const dynamic = 'force-dynamic'

const POLL_MS = 1500

/**
 * SSE stream for one conversation. Emits:
 *  { type: 'connected' }
 *  { type: 'message', message }
 *  { type: 'typing', userId, isTyping, name? }    (name: shared couple account's partner)
 *  { type: 'receipt', messageId, seenBy, allSeen, readAt }   (paid callers only;
 *        for the caller's latest message — "Seen" once every other participant read it)
 *  { type: 'reaction', messageId, reactions }
 *  { type: 'game', messageId, meta }   (someone played a chat game; meta redacted for the caller)
 *  { type: 'participants' }   (someone joined/left, e.g. a partner was linked)
 *  { type: 'revoked' }        (the caller is no longer a participant)
 *
 * Each poll does one light query (conversation.updatedAt + every
 * participant's typingUntil / unreadCount). Messages / reactions are only
 * queried when updatedAt changed — every write path touches the conversation.
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
  let receiptKey = ''
  let unreadKey = ''
  let participantsKey = ''
  const typingState = new Map<string, string>()
  const reactionCache = new Map<string, string>()
  const gameCache = new Map<string, string>()
  let viewerSide: string[] = [userId]
  const GAME_WINDOW = 60
  const loadGames = () => db.message.findMany({
    where: { conversationId, kind: 'GAME' },
    orderBy: { createdAt: 'desc' },
    take: GAME_WINDOW,
    select: { id: true, senderId: true, meta: true },
  })
  const refreshSide = async () => {
    const ps = await db.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } })
    viewerSide = sideOf(userId, await getPartnerMap(ps.map((p) => p.userId)))
  }
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
      const [latest, conv, reacted, games] = await Promise.all([
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
        loadGames(),
        refreshSide(),
      ])
      lastMessageId = latest?.id ?? null
      for (const g of games) gameCache.set(g.id, JSON.stringify(redactGameMeta(g.meta, g.senderId, userId, viewerSide)))
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
                select: { userId: true, typingUntil: true, unreadCount: true },
              },
            },
          })
          if (!conv) { closed = true; clearInterval(poll); return }
          if (!conv.participants.some((p) => p.userId === userId)) {
            // Removed (e.g. the couple link that added them was undone)
            send({ type: 'revoked' })
            closed = true; clearInterval(poll)
            try { controller.close() } catch { /* ignore */ }
            return
          }
          const others = conv.participants.filter((p) => p.userId !== userId)

          // ── Participants joined / left ────────────────────────────────
          const pKey = others.map((p) => p.userId).sort().join(',')
          if (participantsKey && pKey !== participantsKey) {
            await refreshSide()
            send({ type: 'participants' })
          }
          participantsKey = pKey

          // ── Typing (every other participant, named) ───────────────────
          for (const p of others) {
            const isTyping = !!p.typingUntil && p.typingUntil.getTime() > now
            const name = isTyping ? getTypingAs(conversationId, p.userId) : null
            const key = isTyping ? `1|${name ?? ''}` : '0'
            if ((typingState.get(p.userId) ?? '0') !== key) {
              typingState.set(p.userId, key)
              send({ type: 'typing', userId: p.userId, isTyping, ...(name ? { name } : {}) })
            }
          }

          // ── Read receipts (others' unread counts moved) ───────────────
          const uKey = others.map((p) => `${p.userId}:${p.unreadCount}`).sort().join(',')
          const unreadChanged = uKey !== unreadKey
          unreadKey = uKey

          const updatedAt = conv.updatedAt.getTime()
          if (paid && unreadChanged) {
            const r = await computeReceipt(conversationId, userId)
            const key = r ? `${r.messageId}|${r.seenBy.join(',')}|${r.allSeen}` : ''
            if (r && key !== receiptKey) {
              send({ type: 'receipt', ...r })
              receiptKey = key
            }
          }

          if (updatedAt !== lastUpdatedAt) {
            lastUpdatedAt = updatedAt

            const [newMessages, reacted, games] = await Promise.all([
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
                  kind: true,
                  audioUrl: true,
                  audioDurationSec: true,
                  meta: true,
                  isPriority: true,
                  senderId: true,
                  senderPartnerName: true,
                  sender: {
                    select: {
                      id: true,
                      username: true,
                      profile: { select: { displayName: true, profilePhoto: true } },
                    },
                  },
                  isRead: true,
                  readAt: true,
                  reactions: true,
                  createdAt: true,
                },
              }),
              db.message.findMany({
                where: { conversationId, reactions: { not: Prisma.AnyNull } },
                select: { id: true, reactions: true },
              }),
              loadGames(),
            ])

            // ── New messages ────────────────────────────────────────────
            const incomingIds: string[] = []
            for (const raw of newMessages) {
              const msg = messageForViewer(raw, userId, viewerSide)
              if (msg.kind === 'GAME') gameCache.set(msg.id, JSON.stringify(msg.meta))
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

            // ── Game answers ────────────────────────────────────────────
            for (const g of games) {
              const meta = redactGameMeta(g.meta, g.senderId, userId, viewerSide)
              const key = JSON.stringify(meta)
              if (gameCache.get(g.id) !== key) {
                gameCache.set(g.id, key)
                send({ type: 'game', messageId: g.id, meta })
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
