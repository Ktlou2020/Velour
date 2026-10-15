import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id

    const [user, profile, photos, likes, matches, notifications, events, forumPosts, albums, albumAccess] =
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
          select: {
            url: true, thumbnailUrl: true, isProfile: true, isPrivate: true, caption: true, createdAt: true,
            mimeType: true, sizeBytes: true, album: { select: { name: true } },
          },
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
        db.album.findMany({
          where: { ownerId: userId, name: { not: { startsWith: '__' } } },
          select: {
            name: true, description: true, isPrivate: true, createdAt: true,
            _count: { select: { photos: true } },
            access: { select: { status: true, createdAt: true, user: { select: { username: true } } } },
          },
        }),
        db.albumAccess.findMany({
          where: { userId },
          select: { status: true, createdAt: true, album: { select: { name: true, owner: { select: { username: true } } } } },
        }),
      ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: user,
      profile,
      // Media URLs are relative to this site and need you to be signed in.
      photos: photos.map(({ album, ...p }) => ({
        ...p,
        album: album && !album.name.startsWith('__') ? album.name : null,
        kind: album?.name === '__chat' ? 'chat image' : album?.name === '__video' ? 'profile video' : 'photo',
      })),
      albums: albums.map(({ _count, access, ...a }) => ({
        ...a,
        photoCount: _count.photos,
        sharedWith: access.map((x) => ({ username: x.user.username, status: x.status, since: x.createdAt })),
      })),
      albumsSharedWithMe: albumAccess.map((x) => ({
        album: x.album.name, owner: x.album.owner.username, status: x.status, since: x.createdAt,
      })),
      likes,
      matches,
      notifications,
      eventAttendance: events,
      forumPosts,
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="unbound-data-${userId}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error('GET /api/account/export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
