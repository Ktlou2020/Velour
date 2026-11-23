import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { isValidId } from '@/lib/security'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { audit } from '@/lib/admin-team'

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
            createdAt: true,
            profile: { select: { displayName: true, profilePhoto: true, dateOfBirth: true, city: true, isCouple: true } },
            // Public photos to compare the selfie against.
            photos: {
              where: { isPrivate: false, album: null },
              orderBy: [{ isProfile: 'desc' }, { createdAt: 'desc' }],
              take: 6,
              select: { id: true, url: true, isProfile: true },
            },
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
    const me = await requireAdmin()
    if (!me) {
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
    const notes = typeof rawNotes === 'string' && rawNotes.trim() ? rawNotes.trim().slice(0, 500) : undefined
    if (action === 'reject' && !notes) {
      return NextResponse.json({ error: 'Tell the member why, so they can try again' }, { status: 400 })
    }

    const existing = await db.verificationRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true } })
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
        data: { url: action === 'approve' ? '/profile' : '/account', status: newStatus },
      },
    })

    await audit(me.id, action === 'approve' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED', request.userId, notes ? { notes } : undefined)

    sendPushToUser(request.userId, {
      title: action === 'approve' ? '✓ Profile Verified — Unbound' : 'Verification Update — Unbound',
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
