import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { findMatchesBetween, getPartnerMap, isBlockedBetween, sideOf } from '@/lib/couples'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { toUserId: rawToUserId, targetUsername, type: rawType = 'LIKE' } = body as {
      toUserId?: string
      targetUsername?: string
      type?: string
    }

    // Normalise SUPER_LIKE → SUPERLIKE
    const type = rawType === 'SUPER_LIKE' ? 'SUPERLIKE' : rawType as 'LIKE' | 'SUPERLIKE' | 'WINK' | 'PASS'

    // Resolve targetUsername → userId if toUserId not provided
    let toUserId = rawToUserId
    if (!toUserId && targetUsername) {
      const target = await db.user.findUnique({ where: { username: targetUsername }, select: { id: true } })
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      toUserId = target.id
    }

    if (!toUserId) {
      return NextResponse.json({ error: 'toUserId or targetUsername is required' }, { status: 400 })
    }

    if (toUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot like yourself' }, { status: 400 })
    }

    const validTypes = ['LIKE', 'SUPERLIKE', 'WINK', 'PASS']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid like type' }, { status: 400 })
    }

    // Enforce super like credit limit
    if (type === 'SUPERLIKE') {
      const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { superLikeCredits: true, role: true },
      })
      if (!dbUser || (dbUser.role !== 'ADMIN' && (dbUser.superLikeCredits ?? 0) < 1)) {
        return NextResponse.json({ error: 'No super like credits remaining. Earn more by logging in daily!' }, { status: 403 })
      }
      await db.user.update({
        where: { id: session.user.id },
        data: { superLikeCredits: { decrement: 1 } },
      })
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

    // Linked couples like as one: a like from either partner counts for the couple.
    const partnerMap = await getPartnerMap([session.user.id, toUserId])
    const mySide = sideOf(session.user.id, partnerMap)
    const theirSide = sideOf(toUserId, partnerMap)
    const sameCouple = mySide.includes(toUserId)

    // Check for mutual like (anyone on their side → anyone on mine)
    const mutualLike = sameCouple ? null : await db.like.findFirst({
      where: {
        fromUserId: { in: theirSide },
        toUserId: { in: mySide },
        type: { not: 'PASS' },
      },
    })
    const blocked = mutualLike ? await isBlockedBetween(mySide, theirSide) : false

    let matched = false

    if (mutualLike && !blocked) {
      const [user1Id, user2Id] =
        session.user.id < toUserId
          ? [session.user.id, toUserId]
          : [toUserId, session.user.id]

      // Already matched with this person or their partner?
      const existingMatch = (await findMatchesBetween(mySide, theirSide))[0] ?? null

      if (!existingMatch) {
        const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await db.match.create({ data: { user1Id, user2Id, expiresAt: sevenDays } })

        // Notify everyone on both sides (both partners of a linked couple)
        const meId = session.user.id
        const notify = [
          ...mySide.map((u) => ({ userId: u, matchedUserId: toUserId })),
          ...theirSide.map((u) => ({ userId: u, matchedUserId: meId })),
        ]
        await db.notification.createMany({
          data: notify.map((n) => ({
            userId: n.userId,
            type: 'MATCH',
            title: "It's a Match!",
            body: "You have a new match!",
            data: { matchedUserId: n.matchedUserId },
          })),
        })

        for (const n of notify) {
          sendPushToUser(n.userId, { title: "It's a Match! 🎉", body: "You have a new match on Hush!", url: '/matches', tag: `match-${user1Id}-${user2Id}` }).catch(() => {})
        }
        matched = true
      } else {
        matched = true
      }
    }

    // Push notification for a plain like/wink
    if (!matched) {
      const labels: Record<string, string> = { LIKE: 'liked', SUPERLIKE: 'super liked', WINK: 'winked at' }
      sendPushToUser(toUserId, {
        title: 'New Activity — Hush',
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
