import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { isValidId } from '@/lib/security'

/**
 * Submit a report about another member. Also served at /api/report.
 * Body: { reportedUserId | targetUsername, reason, details | note }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`report:${session.user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as {
      reportedUserId?: unknown
      targetUsername?: unknown
      reason?: unknown
      details?: unknown
      note?: unknown
    } | null
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 100) : ''
    const rawDetails = typeof body.details === 'string' ? body.details : typeof body.note === 'string' ? body.note : null
    const details = rawDetails ? rawDetails.slice(0, 1000) : null

    // Accept either reportedUserId or targetUsername
    let reported: { id: string; username: string } | null = null
    if (isValidId(body.reportedUserId)) {
      reported = await db.user.findUnique({ where: { id: body.reportedUserId }, select: { id: true, username: true } })
    } else if (typeof body.targetUsername === 'string' && body.targetUsername.length <= 64) {
      reported = await db.user.findUnique({ where: { username: body.targetUsername }, select: { id: true, username: true } })
    } else {
      return NextResponse.json({ error: 'reportedUserId and reason are required' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'reportedUserId and reason are required' }, { status: 400 })
    }
    if (!reported) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (reported.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    // Reports go to an admin only — never fall back to a regular member, as
    // the notification contains the reporter's id and free-text details.
    const adminUser = await db.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (adminUser) {
      await db.notification.create({
        data: {
          userId: adminUser.id,
          type: 'REPORT',
          title: 'User Report Submitted',
          body: `@${reported.username} has been reported. Reason: ${reason}`,
          data: { reportedBy: session.user.id, reportedUserId: reported.id, reason, details },
        },
      })
    } else {
      console.warn(`REPORT not delivered (no admin account): reportedUserId=${reported.id} reportedBy=${session.user.id} reason=${reason}`)
    }

    return NextResponse.json({ reported: true })
  } catch (error) {
    console.error('POST /api/reports error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
