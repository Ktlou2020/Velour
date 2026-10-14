// Shared helpers for the linked-accounts couple flow. Not a route file.
//
// Invitations are stored as Notification rows (type COUPLE_INVITE) on the
// invitee, with data = { inviterId, inviterUsername, status }. `status` is the
// source of truth (PENDING / ACCEPTED / DECLINED); reading the notification in
// the bell does not change it. Legacy rows without a status count as pending
// while unread. Cancelled invites are deleted.
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

export const INVITE_TYPE = 'COUPLE_INVITE'
export const UPDATE_TYPE = 'COUPLE_UPDATE'

export interface InviteData {
  inviterId?: string
  inviterUsername?: string
  status?: 'PENDING' | 'ACCEPTED' | 'DECLINED'
}

export function inviteData(raw: Prisma.JsonValue | null): InviteData {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as InviteData) : {}
}

export function isPending(n: { isRead: boolean; data: Prisma.JsonValue | null }): boolean {
  const d = inviteData(n.data)
  if (!d.inviterId) return false
  return d.status ? d.status === 'PENDING' : !n.isRead
}

/** Pending invites sent to `userId`. */
export async function incomingInvites(userId: string) {
  const rows = await db.notification.findMany({
    where: { userId, type: INVITE_TYPE },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return rows.filter(isPending)
}

/** Pending invites sent by `userId` (stored on the invitee). */
export async function outgoingInvites(userId: string) {
  const rows = await db.notification.findMany({
    where: { type: INVITE_TYPE, data: { path: ['inviterId'], equals: userId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return rows.filter(isPending)
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const block = await db.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  })
  return !!block
}

/** A couple-account profile (signed up "as a couple") stays a couple when unlinked. */
export function staysCoupleAfterUnlink(coupleMembers: Prisma.JsonValue | null): boolean {
  return Array.isArray(coupleMembers)
}

/** Remove every pending invite to or from either user (after linking). */
export async function clearPendingInvitesFor(userIds: string[]) {
  const rows = await db.notification.findMany({
    where: {
      type: INVITE_TYPE,
      OR: [
        { userId: { in: userIds } },
        ...userIds.map((id) => ({ data: { path: ['inviterId'], equals: id } })),
      ],
    },
    select: { id: true, isRead: true, data: true },
  })
  const ids = rows.filter(isPending).map((r) => r.id)
  if (ids.length) await db.notification.deleteMany({ where: { id: { in: ids } } })
}

export async function notify(userId: string, title: string, body: string, data: Record<string, string> = {}) {
  try {
    await db.notification.create({ data: { userId, type: UPDATE_TYPE, title, body, data } })
    await sendPushToUser(userId, { title, body, url: '/profile#couple', tag: 'couple' })
  } catch {
    /* non-critical */
  }
}

/**
 * Self-heal: a profile marked as a linked couple whose partner was deleted
 * (partnerId set to null by the database) and which isn't a shared couple
 * account goes back to being a single profile.
 */
export async function healOrphanedCouple(userId: string) {
  const p = await db.profile.findUnique({
    where: { userId },
    select: { id: true, isCouple: true, partnerId: true, coupleMembers: true },
  })
  if (!p || !p.isCouple || p.partnerId) return
  if (staysCoupleAfterUnlink(p.coupleMembers)) return // signed up as a couple account
  await db.profile.update({ where: { id: p.id }, data: { isCouple: false, coupleType: null } })
}
