import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { HIDDEN_TYPES, MESSAGE_TYPE, NON_ACTIVITY_TYPES } from '@/lib/notifications'

type Filter = 'all' | 'activity' | 'messages'

function filterWhere(userId: string, filter: Filter, type: string | null): Prisma.NotificationWhereInput {
  if (type) {
    // Hidden admin rows (REPORT) are only returned when asked for by an admin-facing caller by type
    return { userId, type }
  }
  if (filter === 'messages') return { userId, type: MESSAGE_TYPE }
  if (filter === 'activity') return { userId, type: { notIn: NON_ACTIVITY_TYPES } }
  return { userId, type: { notIn: HIDDEN_TYPES } }
}

/**
 * GET /api/notifications?filter=all|activity|messages&limit=30&cursor=<id>
 *   → { notifications, nextCursor, unread: { all, activity, messages } }
 * Newest first. `activity` is what the navbar bell shows (no MESSAGE rows —
 * messages have their own badge). REPORT rows (admin queue) never appear
 * unless requested explicitly with ?type=REPORT.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const rawFilter = searchParams.get('filter')
    const filter: Filter = rawFilter === 'activity' || rawFilter === 'messages' ? rawFilter : 'all'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '30', 10) || 30, 1), 50)
    const cursor = searchParams.get('cursor')

    let cursorRow: { id: string; createdAt: Date } | null = null
    if (cursor) {
      cursorRow = await db.notification.findFirst({ where: { id: cursor, userId }, select: { id: true, createdAt: true } })
    }
    const base = filterWhere(userId, filter, type)
    const where: Prisma.NotificationWhereInput = cursorRow
      ? {
          AND: [
            base,
            { OR: [{ createdAt: { lt: cursorRow.createdAt } }, { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } }] },
          ],
        }
      : base

    const [rows, all, activity, messages] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: { id: true, type: true, title: true, body: true, isRead: true, data: true, createdAt: true },
      }),
      db.notification.count({ where: { userId, isRead: false, type: { notIn: HIDDEN_TYPES } } }),
      db.notification.count({ where: { userId, isRead: false, type: { notIn: NON_ACTIVITY_TYPES } } }),
      db.notification.count({ where: { userId, isRead: false, type: MESSAGE_TYPE } }),
    ])
    const hasMore = rows.length > limit
    const notifications = hasMore ? rows.slice(0, limit) : rows

    return NextResponse.json({
      notifications,
      nextCursor: hasMore ? notifications[notifications.length - 1].id : null,
      unread: { all, activity, messages },
      // Back-compat for older clients
      unreadCount: activity,
    })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/notifications
 *   { notificationId } (or { id })  → mark one read (any type — the admin
 *                                     reports screen resolves REPORT rows this way)
 *   { ids: string[] }               → mark several read
 *   { all: true, filter? }          → mark every unread one read (never REPORT rows)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = (await req.json().catch(() => ({}))) as {
      notificationId?: unknown
      id?: unknown
      ids?: unknown
      all?: unknown
      filter?: unknown
    }

    if (body.all === true) {
      const filter: Filter = body.filter === 'activity' || body.filter === 'messages' ? body.filter : 'all'
      const r = await db.notification.updateMany({
        where: { ...filterWhere(userId, filter, null), isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ updated: true, count: r.count })
    }

    if (Array.isArray(body.ids)) {
      const ids = body.ids.filter((x): x is string => typeof x === 'string').slice(0, 100)
      const r = ids.length
        ? await db.notification.updateMany({ where: { id: { in: ids }, userId, isRead: false }, data: { isRead: true } })
        : { count: 0 }
      return NextResponse.json({ updated: true, count: r.count })
    }

    const notificationId = typeof body.notificationId === 'string' ? body.notificationId : typeof body.id === 'string' ? body.id : null
    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId, ids or all:true is required' }, { status: 400 })
    }

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true, isRead: true },
    })
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    if (notification.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!notification.isRead) {
      await db.notification.update({ where: { id: notificationId }, data: { isRead: true } })
    }
    return NextResponse.json({ updated: true })
  } catch (error) {
    console.error('PUT /api/notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
