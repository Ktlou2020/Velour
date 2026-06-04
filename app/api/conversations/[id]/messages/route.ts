import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    // Verify user is a participant
    const participation = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    })

    if (!participation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const messages = await db.message.findMany({
      where: { conversationId },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profile: {
              select: { displayName: true, profilePhoto: true },
            },
          },
        },
      },
    })

    // Mark messages as read
    await db.message.updateMany({
      where: {
        conversationId,
        senderId: { not: session.user.id },
        isRead: false,
      },
      data: { isRead: true },
    })

    // Reset unread count
    await db.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
      data: { unreadCount: 0 },
    })

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null

    return NextResponse.json({ messages: messages.reverse(), nextCursor })
  } catch (error) {
    console.error('GET /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const body = await req.json()
    const { content } = body as { content?: string }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // Verify user is a participant
    const participation = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    })

    if (!participation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profile: {
              select: { displayName: true, profilePhoto: true },
            },
          },
        },
      },
    })

    // Update conversation last message
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.trim(),
        lastMessageAt: new Date(),
      },
    })

    // Increment unread count for other participants and create notifications
    const otherParticipants = await db.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: session.user.id },
      },
    })

    for (const participant of otherParticipants) {
      await db.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: participant.userId,
          },
        },
        data: { unreadCount: { increment: 1 } },
      })

      await db.notification.create({
        data: {
          userId: participant.userId,
          type: 'MESSAGE',
          title: 'New Message',
          body: content.trim().slice(0, 100),
          data: { conversationId, senderId: session.user.id },
        },
      })
      sendPushToUser(participant.userId, {
        title: 'New Message — Velour',
        body: content.trim().slice(0, 100),
        url: `/messages`,
        tag: `message-${conversationId}`,
      }).catch(() => {})
    }

    // Extend match expiry — once conversation is active the match never expires
    const otherUserId = otherParticipants[0]?.userId
    if (otherUserId) {
      const [u1, u2] = session.user.id < otherUserId
        ? [session.user.id, otherUserId]
        : [otherUserId, session.user.id]
      db.match.updateMany({
        where: { user1Id: u1, user2Id: u2 },
        data: { expiresAt: null },
      }).catch(() => {})
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('POST /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
