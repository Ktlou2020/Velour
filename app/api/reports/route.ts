import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      reportedUserId?: string
      targetUsername?: string
      reason?: string
      details?: string
      note?: string
    }

    const { reason } = body

    // Accept either reportedUserId or targetUsername
    let reportedUserId = body.reportedUserId
    if (!reportedUserId && body.targetUsername) {
      const target = await db.user.findUnique({ where: { username: body.targetUsername }, select: { id: true } })
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      reportedUserId = target.id
    }

    const details = body.details ?? body.note

    if (!reportedUserId || !reason) {
      return NextResponse.json({ error: 'reportedUserId and reason are required' }, { status: 400 })
    }

    if (reportedUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    const adminUser = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
      ?? await db.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })

    if (adminUser) {
      const reportedUser = await db.user.findUnique({ where: { id: reportedUserId }, select: { username: true } })
      await db.notification.create({
        data: {
          userId: adminUser.id,
          type: 'REPORT',
          title: 'User Report Submitted',
          body: `@${reportedUser?.username ?? reportedUserId} has been reported. Reason: ${reason}`,
          data: { reportedBy: session.user.id, reportedUserId, reason, details: details ?? null },
        },
      })
    }

    return NextResponse.json({ reported: true })
  } catch (error) {
    console.error('POST /api/reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
