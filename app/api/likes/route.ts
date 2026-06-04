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
    const { toUserId, type = 'LIKE' } = body as {
      toUserId?: string
      type?: 'LIKE' | 'SUPERLIKE' | 'WINK'
    }

    if (!toUserId) {
      return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
    }

    if (toUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot like yourself' }, { status: 400 })
    }

    const validTypes = ['LIKE', 'SUPERLIKE', 'WINK']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid like type' }, { status: 400 })
    }

    // Upsert like to avoid duplicates
    await db.like.upsert({
      where: {
        fromUserId_toUserId: {
          fromUserId: session.user.id,
          toUserId,
        },
      },
      update: { type },
      create: {
        fromUserId: session.user.id,
        toUserId,
        type,
      },
    })

    // Check for mutual like
    const mutualLike = await db.like.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: toUserId,
          toUserId: session.user.id,
        },
      },
    })

    let matched = false

    if (mutualLike) {
      // Ensure consistent ordering for the unique constraint
      const [user1Id, user2Id] =
        session.user.id < toUserId
          ? [session.user.id, toUserId]
          : [toUserId, session.user.id]

      // Create match (ignore if already exists)
      const existingMatch = await db.match.findUnique({
        where: { user1Id_user2Id: { user1Id, user2Id } },
      })

      if (!existingMatch) {
        await db.match.create({ data: { user1Id, user2Id } })

        // Notify both users
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

        matched = true
      } else {
        matched = true
      }
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
