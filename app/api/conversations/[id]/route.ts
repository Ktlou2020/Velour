import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPaid } from '@/lib/premium'
import { generateIcebreakers } from '@/lib/icebreakers'

/**
 * Conversation details for the chat view: the other participant's public
 * info, the caller's chat settings, match expiry and suggested icebreakers.
 */
export async function GET(
  _req: NextRequest,
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

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } } },
      select: {
        id: true,
        lastMessageAt: true,
        participants: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                username: true,
                interests: { select: { interest: { select: { name: true } } } },
                profile: {
                  select: {
                    displayName: true,
                    profilePhoto: true,
                    isOnline: true,
                    lastSeen: true,
                    city: true,
                    bio: true,
                    prompts: true,
                    membershipTier: true,
                    showChatImages: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const me = conversation.participants.find((p) => p.userId === userId)?.user
    const other = conversation.participants.find((p) => p.userId !== userId)?.user ?? null

    let matchExpiresAt: Date | null = null
    if (other) {
      const [u1, u2] = userId < other.id ? [userId, other.id] : [other.id, userId]
      const match = await db.match.findUnique({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        select: { expiresAt: true },
      })
      matchExpiresAt = match?.expiresAt ?? null
    }

    const hasMessages = conversation._count.messages > 0
    const icebreakers = !hasMessages && other
      ? generateIcebreakers(
          {
            displayName: other.profile?.displayName ?? other.username,
            city: other.profile?.city,
            bio: other.profile?.bio,
            interests: other.interests.map((i) => i.interest.name),
            prompts: other.profile?.prompts,
          },
          {
            interests: me?.interests.map((i) => i.interest.name) ?? [],
            city: me?.profile?.city,
          },
        )
      : []

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        hasMessages,
        matchExpiresAt: hasMessages ? null : matchExpiresAt,
        expired: !hasMessages && !!matchExpiresAt && matchExpiresAt.getTime() < Date.now(),
        other: other && {
          id: other.id,
          username: other.username,
          displayName: other.profile?.displayName ?? other.username,
          profilePhoto: other.profile?.profilePhoto ?? null,
          isOnline: other.profile?.isOnline ?? false,
          lastSeen: other.profile?.lastSeen ?? null,
          city: other.profile?.city ?? null,
        },
      },
      me: {
        isPaid: isPaid(me?.profile?.membershipTier, role),
        showChatImages: me?.profile?.showChatImages ?? false,
      },
      icebreakers,
    })
  } catch (error) {
    console.error('GET /api/conversations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
