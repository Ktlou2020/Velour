import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { toUserId, type = 'LIKE' } = body as {
      toUserId?: string
      type?: 'LIKE' | 'SUPERLIKE' | 'WINK' | 'PASS'
    }

    if (!toUserId) {
      return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
    }

    if (toUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot like yourself' }, { status: 400 })
    }

    const validTypes = ['LIKE', 'SUPERLIKE', 'WINK', 'PASS']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid like type' }, { status: 400 })
    }

    // Upsert to avoid duplicates
    await db.like.upsert({
      where: { fromUserId_toUserId: { fromUserId: session.user.id, toUserId } },
      update: { type, createdAt: new Date() },
      create: { fromUserId: session.user.id, toUserId, type },
    })

    // Passes don't create matches
    if (type === 'PASS') {
      return NextResponse.json({ passed: true, matched: false })
    }

    // Check for mutual like
    const mutualLike = await db.like.findFirst({
      where: {
        fromUserId: toUserId,
        toUserId: session.user.id,
        type: { not: 'PASS' },
      },
    })

    let matched = false

    if (mutualLike) {
      const [user1Id, user2Id] =
        session.user.id < toUserId
          ? [session.user.id, toUserId]
          : [toUserId, session.user.id]

      const existingMatch = await db.match.findUnique({
        where: { user1Id_user2Id: { user1Id, user2Id } },
      })

      if (!existingMatch) {
        await db.match.create({ data: { user1Id, user2Id } })

        await db.notification.createMany({
          data: [
            {
              userId: session.user.id,
              type: 'MATCH',
              title: "It's a Match!",
              body: "You have a new match!",
              data: { matchedUserId: toUserId },
            },
            {
              userId: toUserId,
              type: 'MATCH',
              title: "It's a Match!",
              body: "You have a new match!",
              data: { matchedUserId: session.user.id },
            },
          ],
        })

        // Push to both users on new match
        sendPushToUser(session.user.id, { title: "It's a Match! 🎉", body: "You have a new match on Velour!", url: '/messages', tag: `match-${user1Id}-${user2Id}` }).catch(() => {})
        sendPushToUser(toUserId, { title: "It's a Match! 🎉", body: "You have a new match on Velour!", url: '/messages', tag: `match-${user1Id}-${user2Id}` }).catch(() => {})
        matched = true
      } else {
        matched = true
      }
    }

    // Push notification for a plain like/wink
    if (!matched) {
      const labels: Record<string, string> = { LIKE: 'liked', SUPERLIKE: 'super liked', WINK: 'winked at' }
      sendPushToUser(toUserId, {
        title: 'New Activity — Velour',
        body: `Someone ${labels[type] ?? 'liked'} you!`,
        url: '/members',
        tag: `like-${session.user.id}`,
      }).catch(() => {})
    }

    return NextResponse.json({ liked: true, matched })
  } catch (error) {
    console.error('POST /api/likes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check membership tier — only GOLD/PLATINUM can see who liked them
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { membershipTier: true },
    })

    if (!profile || profile.membershipTier === 'FREE') {
      return NextResponse.json(
        { error: 'Upgrade to Gold or Platinum to see who liked you' },
        { status: 403 }
      )
    }

    const likes = await db.like.findMany({
      where: { toUserId: session.user.id },
      include: {
        fromUser: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                profilePhoto: true,
                city: true,
                country: true,
                gender: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ likes })
  } catch (error) {
    console.error('GET /api/likes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
