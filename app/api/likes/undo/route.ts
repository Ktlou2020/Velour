import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPaid } from '@/lib/premium'

const UNDO_WINDOW_MS = 10 * 60 * 1000

/**
 * POST /api/likes/undo — revert the caller's most recent like/pass (within 10 minutes).
 * Paid members only. If the like produced a match, the match is removed too, but only
 * when no messages have been exchanged; otherwise the undo is refused.
 */
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const role = (session.user as { role?: string }).role

    const profile = await db.profile.findUnique({
      where: { userId },
      select: { membershipTier: true },
    })
    if (!isPaid(profile?.membershipTier, role)) {
      return NextResponse.json(
        { error: 'Undo is a Gold & Platinum feature. Upgrade to rewind your last swipe.', upgrade: true },
        { status: 403 }
      )
    }

    const like = await db.like.findFirst({
      where: { fromUserId: userId, createdAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
      include: { toUser: { select: { username: true } } },
    })
    if (!like) {
      return NextResponse.json({ error: 'Nothing to undo — only swipes from the last 10 minutes can be undone.' }, { status: 404 })
    }

    const otherId = like.toUserId
    const [user1Id, user2Id] = userId < otherId ? [userId, otherId] : [otherId, userId]

    let unmatched = false
    let matchId: string | null = null
    let emptyConversationIds: string[] = []

    if (like.type !== 'PASS') {
      const match = await db.match.findUnique({
        where: { user1Id_user2Id: { user1Id, user2Id } },
        select: { id: true, createdAt: true },
      })
      if (match) {
        // Only unwind a match that this swipe created (allow a little clock slack).
        if (match.createdAt.getTime() < like.createdAt.getTime() - 5000) {
          return NextResponse.json(
            { error: 'You were already matched with this member, so this swipe can’t be undone. Unmatch from your matches instead.' },
            { status: 409 }
          )
        }

        const conversations = await db.conversation.findMany({
          where: {
            AND: [
              { participants: { some: { userId } } },
              { participants: { some: { userId: otherId } } },
            ],
          },
          select: { id: true, _count: { select: { messages: true } } },
        })
        if (conversations.some((c) => c._count.messages > 0)) {
          return NextResponse.json(
            { error: 'You’ve already started chatting with this match, so this swipe can’t be undone.' },
            { status: 409 }
          )
        }
        matchId = match.id
        emptyConversationIds = conversations.map((c) => c.id)
      }
    }

    await db.$transaction(async (tx) => {
      await tx.like.delete({ where: { id: like.id } })

      if (matchId) {
        await tx.match.delete({ where: { id: matchId } })
        if (emptyConversationIds.length) {
          await tx.conversation.deleteMany({ where: { id: { in: emptyConversationIds } } })
        }
        // Remove the "It's a Match!" notifications this swipe created
        await tx.notification.deleteMany({
          where: {
            type: 'MATCH',
            createdAt: { gte: like.createdAt },
            OR: [
              { userId, data: { path: ['matchedUserId'], equals: otherId } },
              { userId: otherId, data: { path: ['matchedUserId'], equals: userId } },
            ],
          },
        })
        unmatched = true
      }

      // Refund a spent super like (admins never spend credits)
      if (like.type === 'SUPERLIKE' && role !== 'ADMIN') {
        await tx.user.update({ where: { id: userId }, data: { superLikeCredits: { increment: 1 } } })
      }
    })

    return NextResponse.json({
      undone: true,
      userId: otherId,
      username: like.toUser.username,
      type: like.type,
      unmatched,
    })
  } catch (error) {
    console.error('POST /api/likes/undo error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
