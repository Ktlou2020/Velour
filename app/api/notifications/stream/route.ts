import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  const encoder = new TextEncoder()
  let lastChecked = new Date()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Send initial ping
      sendEvent({ type: 'connected' })

      const poll = async () => {
        if (closed) return

        try {
          const notifications = await db.notification.findMany({
            where: {
              userId,
              isRead: false,
              createdAt: { gt: lastChecked },
            },
            orderBy: { createdAt: 'desc' },
          })

          lastChecked = new Date()

          for (const notification of notifications) {
            sendEvent({ type: 'notification', notification })
          }
        } catch {
          // DB error — keep polling
        }

        if (!closed) {
          setTimeout(poll, 5000)
        }
      }

      // Start polling after first tick
      setTimeout(poll, 5000)
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
