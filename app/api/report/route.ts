import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reportedUserId, reason, details } = body as {
      reportedUserId?: string
      reason?: string
      details?: string
    }

    if (!reportedUserId || !reason) {
      return NextResponse.json(
        { error: 'reportedUserId and reason are required' },
        { status: 400 }
      )
    }

    if (reportedUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    // Find an admin user to notify
    let adminId: string | null = null
    const adminUser = await db.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    })

    if (adminUser) {
      adminId = adminUser.id
    } else {
      // Fall back to first user
      const firstUser = await db.user.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      adminId = firstUser?.id ?? null
    }

    if (adminId) {
      const reportedUser = await db.user.findUnique({
        where: { id: reportedUserId },
        select: { username: true },
      })

      await db.notification.create({
        data: {
          userId: adminId,
          type: 'REPORT',
          title: 'User Report Submitted',
          body: `User @${reportedUser?.username ?? reportedUserId} has been reported. Reason: ${reason}`,
          data: {
            reportedBy: session.user.id,
            reportedUserId,
            reason,
            details: details ?? null,
          },
        },
      })
    }

    return NextResponse.json({ reported: true })
  } catch (error) {
    console.error('POST /api/report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
