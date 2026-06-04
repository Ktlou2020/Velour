import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

export async function GET() {
  try {
    const session = await auth()
    const sessionUser = session?.user as { id?: string; role?: string } | undefined
    if (!sessionUser?.id || sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requests = await db.verificationRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            verificationStatus: true,
            profile: { select: { displayName: true, profilePhoto: true } },
          },
        },
      },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('GET /api/admin/verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    const sessionUser = session?.user as { id?: string; role?: string } | undefined
    if (!sessionUser?.id || sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requestId, action, notes } = await req.json() as {
      requestId: string
      action: 'approve' | 'reject'
      notes?: string
    }

    const request = await db.verificationRequest.update({
      where: { id: requestId },
      data: { status: action === 'approve' ? 'APPROVED' : 'REJECTED', notes },
    })

    const newStatus = action === 'approve' ? 'VERIFIED' : 'REJECTED'

    await db.user.update({
      where: { id: request.userId },
      data: {
        verificationStatus: newStatus,
        ...(action === 'approve' ? { isVerified: true } : {}),
      },
    })

    await db.notification.create({
      data: {
        userId: request.userId,
        type: 'VERIFICATION',
        title: action === 'approve' ? 'Profile Verified! ✓' : 'Verification Update',
        body: action === 'approve'
          ? 'Your profile has been verified. Your verified badge is now visible to other members.'
          : `Your verification was not approved.${notes ? ` Reason: ${notes}` : ''}`,
      },
    })

    sendPushToUser(request.userId, {
      title: action === 'approve' ? '✓ Profile Verified — Velour' : 'Verification Update — Velour',
      body: action === 'approve' ? 'Your verified badge is now live!' : 'Your verification needs attention.',
      url: '/profile',
      tag: 'verification',
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/admin/verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
