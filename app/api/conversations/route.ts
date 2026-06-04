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
      const otherParticipants = p.conversation.participants.filter(
        (cp) => cp.userId !== userId
      )
      return {
        id: p.conversation.id,
        lastMessage: p.conversation.lastMessage,
        lastMessageAt: p.conversation.lastMessageAt,
        unreadCount: p.unreadCount,
        otherParticipants: otherParticipants.map((cp) => ({
          id: cp.user.id,
          username: cp.user.username,
          profile: cp.user.profile,
        })),
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

    const body = await req.json()
    const { userId: otherUserId } = body as { userId?: string }

    if (!otherUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (otherUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 })
    }

    const currentUserId = session.user.id

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
