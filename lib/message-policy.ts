import { db } from '@/lib/db'

/**
 * Who can start a new conversation with a member (Profile.messagePolicy,
 * set in Settings). Existing conversations are never affected, and couple
 * partners can always message each other.
 */
export const MESSAGE_POLICIES = ['EVERYONE', 'VERIFIED', 'LIKED'] as const
export type MessagePolicy = (typeof MESSAGE_POLICIES)[number]

export function isMessagePolicy(v: unknown): v is MessagePolicy {
  return typeof v === 'string' && (MESSAGE_POLICIES as readonly string[]).includes(v)
}

/** Why `senderId` may not start a chat with `targetId`, or null if they may. */
export async function messagePolicyBlock(senderId: string, targetId: string): Promise<string | null> {
  const [sender, target] = await Promise.all([
    db.user.findUnique({ where: { id: senderId }, select: { role: true, isVerified: true } }),
    db.user.findUnique({ where: { id: targetId }, select: { username: true, profile: { select: { messagePolicy: true, displayName: true } } } }),
  ])
  if (!sender || !target) return null
  if (sender.role === 'ADMIN') return null
  const policy = target.profile?.messagePolicy ?? 'EVERYONE'
  if (policy === 'EVERYONE') return null
  const name = target.profile?.displayName || target.username

  if (policy === 'VERIFIED') {
    return sender.isVerified
      ? null
      : `${name} only accepts new messages from verified members. Verify your photo in Settings to message them.`
  }

  // LIKED: they liked (or winked at) you, or you've matched.
  const [liked, matched] = await Promise.all([
    db.like.findFirst({ where: { fromUserId: targetId, toUserId: senderId, type: { not: 'PASS' } }, select: { id: true } }),
    db.match.findFirst({
      where: { OR: [{ user1Id: senderId, user2Id: targetId }, { user1Id: targetId, user2Id: senderId }] },
      select: { id: true },
    }),
  ])
  return liked || matched
    ? null
    : `${name} only accepts new messages from people they’ve liked. Like their profile — if they like you back, you can chat.`
}
