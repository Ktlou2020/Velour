import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPaid } from '@/lib/premium'
import { generateIcebreakers } from '@/lib/icebreakers'
import { CHAT_VIDEO_MAX_BYTES, getMessageAllowance, getPriorityAllowance } from '@/lib/chat-priority'
import { entitlements, planFor } from '@/lib/plans'
import {
  describeSide,
  effectiveExpiry,
  findMatchesBetween,
  getConversationAccess,
  getPartnerMap,
  groupSides,
  loadPeople,
  sideOf,
} from '@/lib/couples'

/**
 * Conversation details for the chat view: who's in it (grouped into sides —
 * a person, a linked couple or a shared couple account), the caller's chat
 * settings, match expiry and suggested icebreakers.
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

    // Lazy sync: adds newly linked partners / removes ex-partners
    const access = await getConversationAccess(conversationId, userId)
    if (!access) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [conversation, partnerMap, people] = await Promise.all([
      db.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, _count: { select: { messages: true } } },
      }),
      getPartnerMap(access.userIds),
      loadPeople(access.userIds),
    ])
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const mySide = sideOf(userId, partnerMap).filter((u) => access.userIds.includes(u))
    const otherIds = access.userIds.filter((u) => !mySide.includes(u))
    const sides = groupSides(otherIds, partnerMap).map((s) => describeSide(s, people))
    const partnerId = mySide.find((u) => u !== userId) ?? null

    const [meRow, matches, priority, messageAllowance] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          interests: { select: { interest: { select: { name: true } } } },
          profile: { select: { membershipTier: true, showChatImages: true, city: true } },
        },
      }),
      findMatchesBetween(sideOf(userId, partnerMap), otherIds),
      getPriorityAllowance(userId, conversationId),
      getMessageAllowance(userId),
    ])

    const hasMessages = conversation._count.messages > 0
    const matchExpiresAt = hasMessages ? null : effectiveExpiry(matches)

    // Icebreakers are based on the first person of the other side
    const leadId = sides[0]?.userIds[0] ?? null
    let icebreakers: string[] = []
    if (!hasMessages && leadId) {
      const lead = await db.user.findUnique({
        where: { id: leadId },
        select: {
          username: true,
          interests: { select: { interest: { select: { name: true } } } },
          profile: { select: { displayName: true, city: true, bio: true, prompts: true } },
        },
      })
      if (lead) {
        icebreakers = generateIcebreakers(
          {
            displayName: sides[0]?.label || lead.profile?.displayName || lead.username,
            city: lead.profile?.city,
            bio: lead.profile?.bio,
            interests: lead.interests.map((i) => i.interest.name),
            prompts: lead.profile?.prompts,
          },
          {
            interests: meRow?.interests.map((i) => i.interest.name) ?? [],
            city: meRow?.profile?.city,
          },
        )
      }
    }

    // Per-participant display info (keyed by userId) for message labels
    const participants: Record<string, {
      name: string
      username: string
      photo: string | null
      coupleLabel: string | null
      isMyPartner: boolean
      isMe: boolean
    }> = {}
    for (const u of access.userIds) {
      const p = people.get(u)
      if (!p) continue
      const side = mySide.includes(u)
        ? describeSide(mySide, people)
        : sides.find((s) => s.userIds.includes(u))
      participants[u] = {
        name: p.name,
        username: p.username,
        photo: p.photo,
        coupleLabel: side?.isCouple ? side.label : null,
        isMyPartner: u === partnerId,
        isMe: u === userId,
      }
    }

    const lead = leadId ? people.get(leadId) : null
    const me = people.get(userId)

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        hasMessages,
        matchExpiresAt,
        expired: !hasMessages && !!matchExpiresAt && matchExpiresAt.getTime() < Date.now(),
        blocked: access.blocked,
        participantCount: access.userIds.length,
        sides,
        participants,
        partner: partnerId ? { id: partnerId, name: people.get(partnerId)?.name ?? '' } : null,
        other: lead && {
          id: lead.id,
          username: lead.username,
          displayName: sides[0]?.label ?? lead.name,
          profilePhoto: lead.photo,
          isOnline: lead.isOnline,
          lastSeen: lead.lastSeen,
          city: lead.city,
        },
      },
      me: {
        isPaid: isPaid(meRow?.profile?.membershipTier, role),
        showChatImages: meRow?.profile?.showChatImages ?? false,
        // Shared couple account: who can be picked in "Sending as"
        coupleNames: !partnerId && me?.coupleNames.length ? me.coupleNames : [],
        // Priority messages: { plan, limit (null = unlimited, 0 = locked), remaining, usedInConversationToday }
        priority,
        // Free plan: messages per rolling 24h { limit (null = unlimited), remaining, resetsAt, welcomeUntil }
        messageAllowance,
        // Chat video caps for this plan
        video: {
          maxSec: entitlements(meRow?.profile?.membershipTier, role).chatVideoMaxSec,
          maxBytes: CHAT_VIDEO_MAX_BYTES[planFor(meRow?.profile?.membershipTier, role)],
        },
      },
      icebreakers,
    })
  } catch (error) {
    console.error('GET /api/conversations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
