import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const participations = await db.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    profile: {
                      select: {
                        displayName: true,
                        profilePhoto: true,
                        isOnline: true,
                        lastSeen: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        conversation: { lastMessageAt: 'desc' },
      },
    })

    const conversations = participations.map((p) => {
      const other = p.conversation.participants.find((cp) => cp.userId !== userId)
      return {
        id: p.conversation.id,
        lastMessage: p.conversation.lastMessage,
        lastMessageAt: p.conversation.lastMessageAt,
        unreadCount: p.unreadCount,
        // Flat fields the messages page expects
        username: other?.user.username ?? '',
        displayName: other?.user.profile?.displayName ?? other?.user.username ?? '',
        profilePhoto: other?.user.profile?.profilePhoto ?? null,
        isOnline: other?.user.profile?.isOnline ?? false,
        otherUserId: other?.user.id ?? null,
      }
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('GET /api/conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { userId?: string; targetUsername?: string }
    let otherUserId = body.userId

    // Accept targetUsername as fallback — resolve to userId
    if (!otherUserId && body.targetUsername) {
      const target = await db.user.findUnique({
        where: { username: body.targetUsername },
        select: { id: true },
      })
      if (!target) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      otherUserId = target.id
    }

    if (!otherUserId) {
      return NextResponse.json({ error: 'userId or targetUsername is required' }, { status: 400 })
    }

    if (otherUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 })
    }

    const currentUserId = session.user.id

    // Check for block between either user
    const block = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: currentUserId },
        ],
      },
    })

    if (block) {
      return NextResponse.json({ error: 'Cannot start a conversation with this user' }, { status: 403 })
    }

    // Check if conversation already exists between these two users
    const existing = await db.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: {
                  select: { displayName: true, profilePhoto: true },
                },
              },
            },
          },
        },
      },
    })

    if (existing) {
      return NextResponse.json({ conversation: existing })
    }

    // Create new conversation
    const conversation = await db.conversation.create({
      data: {
        participants: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: {
                  select: { displayName: true, profilePhoto: true },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    console.error('POST /api/conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
