import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: conversationId } = await params

  // Verify participant
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  })
  if (!participant) return new Response('Forbidden', { status: 403 })

  let lastMessageId: string | null = null
  let closed = false

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

      // Seed lastMessageId with the current latest
      const latest = await db.message.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      lastMessageId = latest?.id ?? null

      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); return }
        try {
          const newMessages = await db.message.findMany({
            where: {
              conversationId,
              ...(lastMessageId ? { id: { gt: lastMessageId } } : {}),
            },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              senderId: true,
              isRead: true,
              createdAt: true,
            },
          })

          for (const msg of newMessages) {
            send({ type: 'message', message: msg })
            lastMessageId = msg.id
          }
        } catch { clearInterval(poll); closed = true }
      }, 1500)

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
