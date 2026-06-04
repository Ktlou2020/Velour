import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const sessionUser = session.user as { id: string; role?: string }
    if (sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [totalUsers, activeToday, newThisWeek, totalMessages, totalMatches, pendingReports] =
      await Promise.all([
        db.user.count(),
        db.profile.count({ where: { lastSeen: { gte: oneDayAgo } } }),
        db.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
        db.message.count(),
        db.match.count(),
        db.notification.count({ where: { type: 'REPORT', isRead: false } }),
      ])

    return NextResponse.json({ totalUsers, activeToday, newThisWeek, totalMessages, totalMatches, pendingReports })
  } catch (error) {
    console.error('GET /api/admin/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
