import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { isValidId } from '@/lib/security'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

export async function GET() {
  try {
    if (!(await requireAdmin())) {
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
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requestId, action, notes: rawNotes } = await req.json().catch(() => ({})) as {
      requestId?: unknown
      action?: unknown
      notes?: unknown
    }
    if (!isValidId(requestId) || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'Valid requestId and action (approve|reject) are required' }, { status: 400 })
    }
    const notes = typeof rawNotes === 'string' ? rawNotes.slice(0, 500) : undefined

    const existing = await db.verificationRequest.findUnique({ where: { id: requestId }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
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
        data: { url: '/profile', status: newStatus },
      },
    })

    sendPushToUser(request.userId, {
      title: action === 'approve' ? '✓ Profile Verified — Hush' : 'Verification Update — Hush',
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
