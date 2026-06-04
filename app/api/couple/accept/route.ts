import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { inviterId: string; notificationId?: string }
    const { inviterId, notificationId } = body

    if (!inviterId) {
      return NextResponse.json({ error: 'inviterId is required' }, { status: 400 })
    }

    const currentUserProfile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    const partnerProfile = await db.profile.findUnique({
      where: { userId: inviterId },
      select: { id: true },
    })

    if (!currentUserProfile || !partnerProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Link both profiles
    await db.profile.update({
      where: { id: currentUserProfile.id },
      data: { partnerId: partnerProfile.id, isCouple: true },
    })
    await db.profile.update({
      where: { id: partnerProfile.id },
      data: { partnerId: currentUserProfile.id, isCouple: true },
    })

    // Mark the invite notification as read
    if (notificationId) {
      await db.notification.updateMany({
        where: { id: notificationId, userId: session.user.id },
        data: { isRead: true },
      })
    } else {
      await db.notification.updateMany({
        where: {
          userId: session.user.id,
          type: 'COUPLE_INVITE',
          isRead: false,
        },
        data: { isRead: true },
      })
    }

    return NextResponse.json({ linked: true })
  } catch (error) {
    console.error('POST /api/couple/accept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
