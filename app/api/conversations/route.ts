import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_UNVERIFIED_ERROR, hasConfirmedEmail } from '@/lib/email-verification'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  describeSide,
  effectiveExpiry,
  findOrCreateConversation,
  getBlockPairs,
  getPartnerMap,
  groupSides,
  loadPeople,
  sideOf,
  syncConversation,
} from '@/lib/couples'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const myMap = await getPartnerMap([userId])
    const mySide = sideOf(userId, myMap)

    // Conversations of me OR my linked partner (so a newly linked partner's
    // existing chats get me added lazily).
    const convs = await db.conversation.findMany({
      where: { participants: { some: { userId: { in: mySide } } } },
      select: {
        id: true,
        lastMessage: true,
        lastMessageAt: true,
        participants: { select: { id: true, userId: true, unreadCount: true } },
      },
      // Postgres DESC puts never-messaged (new match) chats first, as before
      orderBy: { lastMessageAt: 'desc' },
      take: 300,
    })

    const allIds = new Set<string>(mySide)
    for (const c of convs) for (const p of c.participants) allIds.add(p.userId)
    const partnerMap = await getPartnerMap(Array.from(allIds))
    partnerMap.forEach((v) => allIds.add(v))
    const blockPairs = await getBlockPairs(Array.from(allIds))

    const visible: {
      id: string
      lastMessage: string | null
      lastMessageAt: Date | null
      userIds: string[]
      unreadCount: number
    }[] = []
    for (const c of convs) {
      const res = await syncConversation(c.id, c.participants, partnerMap, blockPairs)
      if (!res.userIds.includes(userId) || res.blocked) continue
      const mine = c.participants.find((p) => p.userId === userId)
      visible.push({
        id: c.id,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        userIds: res.userIds,
        unreadCount: mine?.unreadCount ?? 0,
      })
    }

    const people = await loadPeople(visible.flatMap((v) => v.userIds))

    // Pending match expiries between my side and each other side
    const otherIds = new Set<string>()
    for (const v of visible) for (const u of v.userIds) if (!mySide.includes(u)) otherIds.add(u)
    const pendingMatches = otherIds.size
      ? await db.match.findMany({
          where: {
            OR: [
              { user1Id: { in: mySide }, user2Id: { in: Array.from(otherIds) } },
              { user2Id: { in: mySide }, user1Id: { in: Array.from(otherIds) } },
            ],
          },
          select: { user1Id: true, user2Id: true, expiresAt: true },
        })
      : []

    // Last sender for multi-person chats ("Sipho: see you there")
    const multi = visible.filter((v) => v.userIds.length > 2 && v.lastMessageAt)
    const lastSenders = new Map<string, { senderId: string; senderPartnerName: string | null }>()
    await Promise.all(multi.map(async (v) => {
      const m = await db.message.findFirst({
        where: { conversationId: v.id },
        orderBy: { createdAt: 'desc' },
        select: { senderId: true, senderPartnerName: true },
      })
      if (m) lastSenders.set(v.id, m)
    }))

    // Unread priority messages from someone outside my side → pinned to the top
    const unreadIds = visible.filter((v) => v.unreadCount > 0).map((v) => v.id)
    const priorityRows = unreadIds.length
      ? await db.message.findMany({
          where: { conversationId: { in: unreadIds }, isPriority: true, isRead: false, senderId: { notIn: mySide } },
          select: { conversationId: true },
          distinct: ['conversationId'],
        })
      : []
    const prioritySet = new Set(priorityRows.map((r) => r.conversationId))

    const now = Date.now()
    const conversations = visible.map((v) => {
      const others = v.userIds.filter((u) => u !== userId)
      const otherSideIds = others.filter((u) => !mySide.includes(u))
      const partnerHere = others.filter((u) => mySide.includes(u))
      // Keep the principal-ish order stable: the side's first member leads
      const sides = groupSides(otherSideIds, partnerMap).map((s) => describeSide(s, people))
      const primary = sides[0]
      const lead = primary ? people.get(primary.userIds[0]) : people.get(others[0])

      const matches = pendingMatches.filter((m) =>
        (mySide.includes(m.user1Id) && otherSideIds.includes(m.user2Id)) ||
        (mySide.includes(m.user2Id) && otherSideIds.includes(m.user1Id)))
      const expiry = v.lastMessageAt ? null : effectiveExpiry(matches)

      let lastMessage = v.lastMessage
      const ls = lastSenders.get(v.id)
      if (lastMessage && ls) {
        const who = ls.senderId === userId
          ? 'You'
          : (ls.senderPartnerName || people.get(ls.senderId)?.name || '')
        if (who) lastMessage = `${who}: ${lastMessage}`
      }

      const label = sides.length > 0
        ? sides.map((s) => s.label).join(', ')
        : (lead?.name ?? '')
      const avatars = (sides.length > 0 ? sides.flatMap((s) => s.members) : [])
        .slice(0, 4)
        .map((m) => ({ name: m.name, photo: m.photo, username: m.username }))

      return {
        id: v.id,
        lastMessage,
        lastMessageAt: v.lastMessageAt,
        unreadCount: v.unreadCount,
        // Flat fields the messages page / navbar expect
        username: lead?.username ?? '',
        displayName: label,
        profilePhoto: lead?.photo ?? null,
        isOnline: otherSideIds.some((u) => people.get(u)?.isOnline),
        otherUserId: lead?.id ?? null,
        matchExpiresAt: expiry,
        expired: !!expiry && expiry.getTime() < now,
        // Couple-aware fields
        isCouple: sides.some((s) => s.isCouple),
        participantCount: v.userIds.length,
        avatars,
        partnerName: partnerHere.length ? (people.get(partnerHere[0])?.name ?? null) : null,
        priority: prioritySet.has(v.id),
      }
    })
    // Stable: priority chats first, otherwise the existing recency order
    conversations.sort((a, b) => Number(b.priority) - Number(a.priority))

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
    if (!(await hasConfirmedEmail(session.user.id))) {
      return NextResponse.json({ error: EMAIL_UNVERIFIED_ERROR, code: 'EMAIL_UNVERIFIED' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as { userId?: unknown; targetUsername?: unknown }
    let otherUserId = typeof body.userId === 'string' ? body.userId : undefined

    // Accept targetUsername as fallback — resolve to userId
    if (!otherUserId && typeof body.targetUsername === 'string' && body.targetUsername) {
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

    const exists = await db.user.findUnique({ where: { id: otherUserId }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Block check covers both partners on either side
    const result = await findOrCreateConversation(session.user.id, otherUserId)
    if (!result.ok) {
      return NextResponse.json({ error: 'Cannot start a conversation with this user' }, { status: 403 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id: result.conversationId },
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

    return NextResponse.json({ conversation }, { status: result.created ? 201 : 200 })
  } catch (error) {
    console.error('POST /api/conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
