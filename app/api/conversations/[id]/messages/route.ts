import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { isPaid } from '@/lib/premium'

const MAX_CONTENT = 2000

/** Only accept https images hosted on our Cloudinary account. */
function isValidImageUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 1000) return false
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.hostname !== 'res.cloudinary.com') return false
    const cloud = process.env.CLOUDINARY_CLOUD_NAME
    if (cloud && !u.pathname.startsWith(`/${cloud}/`)) return false
    return u.pathname.includes('/image/upload/')
  } catch {
    return false
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const role = (session.user as { role?: string }).role

    const { id: conversationId } = await params
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

    // Verify user is a participant (and fetch tier for read-receipt gating)
    const participation = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { unreadCount: true, user: { select: { profile: { select: { membershipTier: true } } } } },
    })

    if (!participation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const paid = isPaid(participation.user.profile?.membershipTier, role)

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

    // Mark messages as read (+ readAt for paid senders' read receipts)
    const marked = await db.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    })

    if (marked.count > 0 || participation.unreadCount > 0) {
      await db.$transaction([
        db.conversationParticipant.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { unreadCount: 0 },
        }),
        // Touch the conversation so the sender's SSE stream picks up the read
        db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        }),
      ])
    }

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null

    // Read receipts on your own sent messages are a paid feature
    const out = messages.reverse().map((m) =>
      m.senderId === userId && !paid ? { ...m, isRead: false, readAt: null } : m
    )

    return NextResponse.json({ messages: out, nextCursor })
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
    const userId = session.user.id

    const { id: conversationId } = await params
    const body = await req.json().catch(() => ({}))
    const { content: rawContent, imageUrl: rawImageUrl } = body as { content?: unknown; imageUrl?: unknown }

    const content = typeof rawContent === 'string' ? rawContent.trim() : ''
    let imageUrl: string | null = null
    if (rawImageUrl !== undefined && rawImageUrl !== null && rawImageUrl !== '') {
      if (!isValidImageUrl(rawImageUrl)) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
      }
      imageUrl = rawImageUrl
    }

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'content or imageUrl is required' }, { status: 400 })
    }
    if (content.length > MAX_CONTENT) {
      return NextResponse.json({ error: `Message must be under ${MAX_CONTENT} characters` }, { status: 400 })
    }

    // Verify user is a participant
    const participation = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    })

    if (!participation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const otherParticipants = await db.conversationParticipant.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    })
    const otherUserId = otherParticipants[0]?.userId
    const pair = otherUserId
      ? (userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId])
      : null

    // An expired match (nobody said hi within the window) can't be revived by messaging
    if (pair) {
      const match = await db.match.findUnique({
        where: { user1Id_user2Id: { user1Id: pair[0], user2Id: pair[1] } },
        select: { expiresAt: true },
      })
      if (match?.expiresAt && match.expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ error: 'This match has expired' }, { status: 410 })
      }
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        imageUrl,
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

    const preview = content ? content.slice(0, 100) : '📷 Photo'

    // Update conversation last message; stop the sender's typing indicator
    await db.$transaction([
      db.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: content || '📷 Photo', lastMessageAt: new Date() },
      }),
      db.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { typingUntil: null },
      }),
    ])

    for (const participant of otherParticipants) {
      await db.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: participant.userId } },
        data: { unreadCount: { increment: 1 } },
      })

      await db.notification.create({
        data: {
          userId: participant.userId,
          type: 'MESSAGE',
          title: 'New Message',
          body: preview,
          data: { conversationId, senderId: userId },
        },
      })
      sendPushToUser(participant.userId, {
        title: 'New Message — Hush',
        body: preview,
        url: `/messages`,
        tag: `message-${conversationId}`,
      }).catch(() => {})
    }

    // Extend match expiry — once conversation is active the match never expires
    if (pair) {
      db.match.updateMany({
        where: { user1Id: pair[0], user2Id: pair[1] },
        data: { expiresAt: null },
      }).catch(() => {})
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('POST /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
