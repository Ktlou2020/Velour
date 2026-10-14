import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUnreadCounts } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications/unread → { notifications, unreadConversations, unreadMessages }
 * Cheap counts for the navbar bell and the Messages badges (polling fallback
 * for /api/notifications/stream, which pushes the same shape as `counts`).
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const counts = await getUnreadCounts(session.user.id)
    return NextResponse.json(counts, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/notifications/unread error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
