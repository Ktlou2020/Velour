import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

// Public-safe profile fields. Never expose coordinates, privacy flags or boost bookkeeping.
const PUBLIC_PROFILE_SELECT = {
  id: true,
  displayName: true,
  bio: true,
  dateOfBirth: true,
  gender: true,
  orientation: true,
  relationshipStatus: true,
  lookingFor: true,
  location: true,
  city: true,
  country: true,
  profilePhoto: true,
  isOnline: true,
  lastSeen: true,
  membershipTier: true,
  profileCompleteness: true,
  profileViews: true,
  allowMessages: true,
  isCouple: true,
  videoUrl: true,
  prompts: true,
} as const

export async function GET(
  req: NextRequest,
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
        profile: { select: PUBLIC_PROFILE_SELECT },
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

    // Track profile view (don't count self-views, incognito viewers, or ?track=0 lookups)
    const skipTracking = req.nextUrl.searchParams.get('track') === '0'
    let viewerIncognito = false
    if (!skipTracking && user.id !== session.user.id) {
      const viewerProfile = await db.profile.findUnique({
        where: { userId: session.user.id },
        select: { incognito: true },
      })
      viewerIncognito = !!viewerProfile?.incognito
    }
    if (!skipTracking && !viewerIncognito && user.id !== session.user.id) {
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
