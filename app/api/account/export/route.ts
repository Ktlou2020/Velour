import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id

    const [user, profile, photos, likes, matches, notifications, events, forumPosts] =
      await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
            isVerified: true,
            role: true,
            loginStreak: true,
            lastLoginDate: true,
            verificationStatus: true,
          },
        }),
        db.profile.findUnique({
          where: { userId },
          select: {
            displayName: true,
            bio: true,
            dateOfBirth: true,
            gender: true,
            orientation: true,
            relationshipStatus: true,
            lookingFor: true,
            city: true,
            country: true,
            membershipTier: true,
            profileViews: true,
            isOnline: true,
            lastSeen: true,
          },
        }),
        db.photo.findMany({
          where: { userId },
          select: { url: true, isProfile: true, isPrivate: true, caption: true, createdAt: true },
        }),
        db.like.findMany({
          where: { fromUserId: userId },
          select: { toUserId: true, type: true, createdAt: true },
        }),
        db.match.findMany({
          where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
          select: { user1Id: true, user2Id: true, createdAt: true, expiresAt: true },
        }),
        db.notification.findMany({
          where: { userId },
          select: { type: true, title: true, body: true, isRead: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        db.eventAttendee.findMany({
          where: { userId },
          select: { eventId: true, status: true, createdAt: true },
        }),
        db.forumPost.findMany({
          where: { authorId: userId },
          select: { content: true, createdAt: true },
          take: 100,
        }),
      ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: user,
      profile,
      photos,
      likes,
      matches,
      notifications,
      eventAttendance: events,
      forumPosts,
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="velour-data-${userId}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error('GET /api/account/export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
