import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { HIDDEN_TYPES, getUnreadCounts } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const POLL_MS = 5000
/** Close after a while so the browser's EventSource reconnects (bounded server work per connection). */
const MAX_LIFETIME_MS = 10 * 60 * 1000
const KEEPALIVE_EVERY = 5 // polls (~25 s)

/**
 * SSE for the navbar bell and the Messages badges. Emits:
 *   { type: 'connected' }
 *   { type: 'counts', notifications, unreadConversations, unreadMessages }
 *        on connect and whenever any of them changes
 *   { type: 'notification', notification }
 *        a new unread notification, or one that was updated and bumped (the
 *        per-conversation MESSAGE row, photo-like summaries) — clients replace by id
 * The client falls back to polling GET /api/notifications/unread if this fails.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = session.user.id

  const encoder = new TextEncoder()
  let lastChecked = new Date()
  let lastCountsKey = ''
  // id → createdAt already sent (queries overlap a little so a row committed
  // just after a poll isn't missed)
  const sent = new Map<string, number>()
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const startedAt = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }
      const sendEvent = (data: object) => write(`data: ${JSON.stringify(data)}\n\n`)
      const finish = () => {
        if (closed) return
        closed = true
        if (timer) clearTimeout(timer)
        try { controller.close() } catch { /* already closed */ }
      }

      req.signal.addEventListener('abort', finish)

      // Retry hint for the browser's automatic reconnect
      write('retry: 5000\n\n')
      sendEvent({ type: 'connected' })

      let ticks = 0
      const poll = async () => {
        if (closed) return
        try {
          // Overlap 3 s with the previous poll (not before the connection opened)
          const since = new Date(Math.max(startedAt, lastChecked.getTime() - 3000))
          lastChecked = new Date()
          const [fresh, counts] = await Promise.all([
            db.notification.findMany({
              where: { userId, isRead: false, createdAt: { gt: since }, type: { notIn: HIDDEN_TYPES } },
              orderBy: { createdAt: 'asc' },
              take: 20,
              select: { id: true, type: true, title: true, body: true, isRead: true, data: true, createdAt: true },
            }),
            getUnreadCounts(userId),
          ])
          for (const notification of fresh) {
            const at = notification.createdAt.getTime()
            if (sent.get(notification.id) === at) continue
            sent.set(notification.id, at)
            sendEvent({ type: 'notification', notification })
          }
          if (sent.size > 500) sent.clear()
          const key = `${counts.notifications}|${counts.unreadConversations}|${counts.unreadMessages}`
          if (key !== lastCountsKey) {
            lastCountsKey = key
            sendEvent({ type: 'counts', ...counts })
          }
          if (++ticks % KEEPALIVE_EVERY === 0) write(': ping\n\n')
        } catch {
          // DB hiccup — keep the stream and try again next tick
        }
        if (closed) return
        if (Date.now() - startedAt > MAX_LIFETIME_MS) { finish(); return }
        timer = setTimeout(poll, POLL_MS)
      }

      // Counts straight away, then every POLL_MS
      await poll()
    },
    cancel() {
      closed = true
      if (timer) clearTimeout(timer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
