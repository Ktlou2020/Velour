// Server-side notification helpers: message notifications (deduped per
// conversation), mark-read on open, and the unread counts behind the navbar
// bell, the Messages badges and the /api/notifications/stream SSE.
//
// Counting rules (kept in one place so every badge agrees):
//  • Bell / "activity" = unread notifications EXCEPT `MESSAGE` (messages have
//    their own badge) and `REPORT` (an admin work queue, resolved in /admin).
//  • Messages badge = unread messages from ConversationParticipant.unreadCount,
//    skipping conversations hidden by a block; `unreadConversations` is how
//    many conversations have any.
//  • /notifications lists everything but REPORT (MESSAGE included, one row per
//    conversation).
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getBlockPairs, getPartnerMap, sideOf, blockedAcross } from '@/lib/couples'

export const MESSAGE_TYPE = 'MESSAGE'
/** Never shown to members in the bell or on /notifications (admin queue rows). */
export const HIDDEN_TYPES = ['REPORT']
/** Excluded from the bell count/dropdown. */
export const NON_ACTIVITY_TYPES = [MESSAGE_TYPE, ...HIDDEN_TYPES]

export interface UnreadCounts {
  /** Unread bell notifications (everything but MESSAGE / REPORT). */
  notifications: number
  /** Conversations with at least one unread message. */
  unreadConversations: number
  /** Unread messages across those conversations. */
  unreadMessages: number
}

/** Unread messages, ignoring conversations a block hides from the inbox. */
export async function getUnreadMessageCounts(userId: string): Promise<{ unreadConversations: number; unreadMessages: number }> {
  const rows = await db.conversationParticipant.findMany({
    where: { userId, unreadCount: { gt: 0 } },
    select: { unreadCount: true, conversation: { select: { participants: { select: { userId: true } } } } },
    take: 500,
  })
  if (rows.length === 0) return { unreadConversations: 0, unreadMessages: 0 }

  const everyone = new Set<string>([userId])
  for (const r of rows) for (const p of r.conversation.participants) everyone.add(p.userId)
  const partnerMap = await getPartnerMap(Array.from(everyone))
  partnerMap.forEach((v) => everyone.add(v))
  const pairs = await getBlockPairs(Array.from(everyone))
  const mySide = sideOf(userId, partnerMap)

  let unreadConversations = 0
  let unreadMessages = 0
  for (const r of rows) {
    const others = r.conversation.participants.map((p) => p.userId).filter((u) => !mySide.includes(u))
    const expanded = new Set(others)
    for (const u of others) { const p = partnerMap.get(u); if (p) expanded.add(p) }
    if (pairs.size > 0 && blockedAcross(mySide, Array.from(expanded), pairs)) continue
    unreadConversations++
    unreadMessages += r.unreadCount
  }
  return { unreadConversations, unreadMessages }
}

export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const [notifications, msgs] = await Promise.all([
    db.notification.count({ where: { userId, isRead: false, type: { notIn: NON_ACTIVITY_TYPES } } }),
    getUnreadMessageCounts(userId),
  ])
  return { notifications, ...msgs }
}

/** Mark the MESSAGE notifications for one conversation read (the member opened it). */
export async function markConversationNotificationsRead(userId: string, conversationId: string): Promise<number> {
  try {
    const r = await db.notification.updateMany({
      where: { userId, type: MESSAGE_TYPE, isRead: false, data: { path: ['conversationId'], equals: conversationId } },
      data: { isRead: true },
    })
    return r.count
  } catch (e) {
    console.error('markConversationNotificationsRead failed:', e instanceof Error ? e.message : e)
    return 0
  }
}

function firstName(label: string): string {
  // "Thandi (Thandi & Sipho)" → "Thandi"; "@thandi" stays
  const i = label.indexOf(' (')
  return i > 0 ? label.slice(0, i) : label
}

/**
 * One MESSAGE notification per conversation while it's unread: a second
 * message updates it ("Thandi sent you 3 messages") and bumps it to the top
 * instead of adding another row.
 */
export async function upsertMessageNotification(opts: {
  userId: string
  conversationId: string
  senderId: string
  senderLabel: string
  preview: string
  isPriority: boolean
  senderPartnerName?: string | null
  multi?: boolean
}): Promise<void> {
  const { userId, conversationId, senderId, senderLabel, preview, isPriority, senderPartnerName, multi } = opts
  const url = `/messages?conv=${conversationId}`
  const body = preview.slice(0, 200)
  // In a group chat, later updates name who wrote the latest line
  const groupBody = (multi ? `${firstName(senderLabel)}: ${preview}` : preview).slice(0, 200)
  try {
    const existing = await db.notification.findFirst({
      where: { userId, type: MESSAGE_TYPE, isRead: false, data: { path: ['conversationId'], equals: conversationId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true },
    })
    if (existing) {
      const prev = (existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data) ? existing.data : {}) as Record<string, unknown>
      const count = (typeof prev.count === 'number' ? prev.count : 1) + 1
      const priority = isPriority || prev.priority === true
      const senders = Array.isArray(prev.senderIds) ? (prev.senderIds as unknown[]).filter((x): x is string => typeof x === 'string') : []
      if (!senders.includes(senderId)) senders.push(senderId)
      const title = senders.length > 1
        ? `${count} new messages in your group chat`
        : `${firstName(senderLabel)} sent you ${count} messages`
      await db.notification.update({
        where: { id: existing.id },
        data: {
          title: `${priority ? '⚡ ' : ''}${title}`,
          body: groupBody,
          createdAt: new Date(),
          data: {
            ...prev, url, conversationId, senderId, count, senderIds: senders.slice(0, 20),
            ...(senderPartnerName ? { senderPartnerName } : {}),
            ...(priority ? { priority: true } : {}),
          } as Prisma.InputJsonValue,
        },
      })
      return
    }
    // Keep one row per conversation: drop the older, already-read ones
    await db.notification.deleteMany({
      where: { userId, type: MESSAGE_TYPE, isRead: true, data: { path: ['conversationId'], equals: conversationId } },
    })
    await db.notification.create({
      data: {
        userId,
        type: MESSAGE_TYPE,
        title: isPriority ? `⚡ Priority message from ${senderLabel}` : `New message from ${senderLabel}`,
        body,
        data: {
          url, conversationId, senderId, count: 1, senderIds: [senderId],
          ...(senderPartnerName ? { senderPartnerName } : {}),
          ...(isPriority ? { priority: true } : {}),
        },
      },
    })
  } catch (e) {
    console.error('message notification failed:', e instanceof Error ? e.message : e)
  }
}
