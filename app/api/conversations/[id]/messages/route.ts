import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { isPaid } from '@/lib/premium'
import {
  computeReceipt,
  effectiveExpiry,
  findMatchesBetween,
  getConversationAccess,
  getCoupleMemberNames,
  getPartnerMap,
  sideOf,
} from '@/lib/couples'

const MAX_CONTENT = 2000

/**
 * Only accept images the sender uploaded to Hush (`/api/media/<id>`, from
 * POST /api/upload with purpose=chat) or legacy Cloudinary images.
 */
async function isValidImageUrl(raw: unknown, senderId: string): Promise<boolean> {
  const { isSendableChatImage } = await import('@/lib/media-access')
  return isSendableChatImage(raw, senderId)
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

    // Lazy couple sync (adds linked partners / removes ex-partners), then
    // verify user is a participant (and fetch tier for read-receipt gating)
    const access = await getConversationAccess(conversationId, userId)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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
    // With several recipients "read" means every other participant has read it.
    const receipt = paid ? await computeReceipt(conversationId, userId) : null
    const multi = access.userIds.length > 2
    const out = messages.reverse().map((m) => {
      if (m.senderId !== userId) return m
      if (!paid) return { ...m, isRead: false, readAt: null }
      if (multi) {
        const isLatest = receipt?.messageId === m.id
        return { ...m, isRead: isLatest ? receipt!.allSeen : m.isRead, seenBy: isLatest ? receipt!.seenBy : undefined }
      }
      return m
    })

    return NextResponse.json({ messages: out, nextCursor, receipt })
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
    const { content: rawContent, imageUrl: rawImageUrl, senderPartnerName: rawPartnerName } =
      body as { content?: unknown; imageUrl?: unknown; senderPartnerName?: unknown }

    const content = typeof rawContent === 'string' ? rawContent.trim() : ''
    let imageUrl: string | null = null
    if (rawImageUrl !== undefined && rawImageUrl !== null && rawImageUrl !== '') {
      if (typeof rawImageUrl !== 'string' || !(await isValidImageUrl(rawImageUrl, userId))) {
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

    // Verify user is a participant (after the lazy couple sync)
    const access = await getConversationAccess(conversationId, userId)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // A block by/against anyone on either side (incl. linked partners)
    if (access.blocked) {
      return NextResponse.json({ error: 'You can no longer message in this conversation' }, { status: 403 })
    }

    // Shared couple account: which of the two is writing
    const me = await db.profile.findUnique({
      where: { userId },
      select: { isCouple: true, partnerId: true, coupleMembers: true, displayName: true, user: { select: { username: true } } },
    })
    const coupleNames = me?.isCouple && !me.partnerId ? getCoupleMemberNames(me.coupleMembers) : []
    let senderPartnerName: string | null = null
    if (typeof rawPartnerName === 'string' && rawPartnerName.trim()) {
      const wanted = rawPartnerName.trim()
      if (!coupleNames.includes(wanted)) {
        return NextResponse.json({ error: 'Choose who is sending this message' }, { status: 400 })
      }
      senderPartnerName = wanted
    }

    const otherParticipants = access.userIds.filter((u) => u !== userId).map((u) => ({ userId: u }))
    const partnerMap = await getPartnerMap(access.userIds)
    const mySide = sideOf(userId, partnerMap)
    const otherSide = access.userIds.filter((u) => !mySide.includes(u))
    const sideMatches = await findMatchesBetween(mySide, otherSide)

    // An expired match (nobody said hi within the window) can't be revived by messaging
    const expiry = effectiveExpiry(sideMatches)
    if (expiry && expiry.getTime() < Date.now()) {
      const anyMessage = await db.message.findFirst({ where: { conversationId }, select: { id: true } })
      if (!anyMessage) {
        return NextResponse.json({ error: 'This match has expired' }, { status: 410 })
      }
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        imageUrl,
        senderPartnerName,
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
    // "Thandi" — or for a linked couple member "Thandi (Thandi & Sipho)"
    const myName = me?.displayName || me?.user.username || 'Someone'
    const partnerOfMe = mySide.find((u) => u !== userId)
    let senderLabel = senderPartnerName || myName
    if (partnerOfMe && access.userIds.includes(partnerOfMe)) {
      const pp = await db.profile.findUnique({
        where: { userId: partnerOfMe },
        select: { displayName: true, user: { select: { username: true } } },
      })
      const pn = pp?.displayName || pp?.user.username
      if (pn) senderLabel = `${myName} (${myName} & ${pn})`
    }

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
          title: `New message from ${senderLabel}`,
          body: preview,
          data: { conversationId, senderId: userId, ...(senderPartnerName ? { senderPartnerName } : {}) },
        },
      })
      sendPushToUser(participant.userId, {
        title: `${senderLabel} — Hush`,
        body: preview,
        url: `/messages?conv=${conversationId}`,
        tag: `message-${conversationId}`,
      }).catch(() => {})
    }

    // Extend match expiry — once conversation is active the match never expires
    if (sideMatches.some((m) => m.expiresAt)) {
      db.match.updateMany({
        where: { id: { in: sideMatches.map((m) => m.id) } },
        data: { expiresAt: null },
      }).catch(() => {})
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('POST /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
