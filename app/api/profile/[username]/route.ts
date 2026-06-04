import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params

    const user = await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        createdAt: true,
        isVerified: true,
        profile: true,
        photos: {
          where: { isPrivate: false },
          orderBy: { order: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Track profile view (don't count self-views)
    if (user.id !== session.user.id) {
      await db.profile.update({
        where: { userId: user.id },
        data: { profileViews: { increment: 1 } },
      })

      // Create PROFILE_VIEW notification for GOLD/PLATINUM users only, deduplicated per 24h
      const ownerProfile = user.profile
      if (
        ownerProfile &&
        (ownerProfile.membershipTier === 'GOLD' || ownerProfile.membershipTier === 'PLATINUM')
      ) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const viewerUser = await db.user.findUnique({
          where: { id: session.user.id },
          select: { username: true },
        })

        const existingView = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'PROFILE_VIEW',
            createdAt: { gte: oneDayAgo },
            data: {
              path: ['viewerId'],
              equals: session.user.id,
            },
          },
        })

        if (!existingView && viewerUser) {
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'PROFILE_VIEW',
              title: 'Someone viewed your profile',
              body: `@${viewerUser.username} viewed your profile`,
              data: { viewerId: session.user.id, viewerUsername: viewerUser.username },
            },
          })
          sendPushToUser(user.id, {
            title: 'Profile View — Velour',
            body: `@${viewerUser.username} viewed your profile`,
            url: '/views',
            tag: `view-${session.user.id}`,
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('GET /api/profile/[username] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
