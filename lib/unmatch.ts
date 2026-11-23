import { db } from '@/lib/db'

/**
 * Unmatching ends a match and its chat for both members: the conversation is
 * hidden and closed (it is treated like a blocked pair by lib/couples.ts),
 * neither can start a new chat or match again, and they leave each other's
 * Discover. Unlike blocking, profiles stay visible in Members. Messages are
 * kept for safety review.
 */
export async function unmatch(userId: string, otherId: string): Promise<void> {
  await db.$transaction([
    db.unmatch.upsert({
      where: { userId_otherId: { userId, otherId } },
      create: { userId, otherId },
      update: {},
    }),
    db.like.deleteMany({
      where: { OR: [{ fromUserId: userId, toUserId: otherId }, { fromUserId: otherId, toUserId: userId }] },
    }),
    db.match.deleteMany({
      where: { OR: [{ user1Id: userId, user2Id: otherId }, { user1Id: otherId, user2Id: userId }] },
    }),
  ])
}

/** Unmatch pairs touching any of these users, as "a|b" (either direction is stored once). */
export async function getUnmatchPairs(userIds: string[]): Promise<{ userId: string; otherId: string }[]> {
  const ids = Array.from(new Set(userIds))
  if (ids.length === 0) return []
  return db.unmatch.findMany({
    where: { OR: [{ userId: { in: ids } }, { otherId: { in: ids } }] },
    select: { userId: true, otherId: true },
  })
}

/** True if anyone on side A unmatched anyone on side B, or the reverse. */
export async function isUnmatchedBetween(a: string[], b: string[]): Promise<boolean> {
  if (a.length === 0 || b.length === 0) return false
  const n = await db.unmatch.count({
    where: { OR: [{ userId: { in: a }, otherId: { in: b } }, { userId: { in: b }, otherId: { in: a } }] },
  })
  return n > 0
}

/** Everyone this user unmatched or was unmatched by. */
export async function unmatchedIds(userId: string): Promise<string[]> {
  const rows = await db.unmatch.findMany({
    where: { OR: [{ userId }, { otherId: userId }] },
    select: { userId: true, otherId: true },
  })
  return rows.map((r) => (r.userId === userId ? r.otherId : r.userId))
}
