import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Default "best for you" order for Members and Discover. Each factor adds
 * points; higher scores come first. Explicit sorts (Nearest, Newest, …) via
 * the API are unchanged.
 *
 *   activity   up to 30  online now 30 · today 22 · this week 12 · this month 4
 *   distance   up to 20  closer within the search radius scores more
 *   fit        up to 25  compatibility score (mutual interest, intentions, age …)
 *   replies    up to 20  share of chats they reply to (last 60 days); new
 *                        members with fewer than 3 chats get a neutral 12
 *   profile    up to 10  photo 7, bio 3
 *   promotion  boost +15, paid "priority in search" +3 (Gold) / +5 (Platinum)
 */
export interface RankInput {
  onlineNow: boolean
  lastSeenMs: number | null
  km?: number
  radiusKm: number | null
  callerHasLocation: boolean
  compatibility: number
  reply?: { received: number; replied: number }
  hasPhoto: boolean
  hasBio: boolean
  boosted: boolean
  tierRank: number
  now: number
}

const DAY = 24 * 60 * 60 * 1000

export function rankScore(x: RankInput): number {
  const ago = x.lastSeenMs === null ? Infinity : x.now - x.lastSeenMs
  const activity = x.onlineNow ? 30 : ago < DAY ? 22 : ago < 7 * DAY ? 12 : ago < 30 * DAY ? 4 : 0

  let distance: number
  if (!x.callerHasLocation) distance = 10
  else if (x.km === undefined) distance = 5
  else {
    const scale = Math.max(x.radiusKm ?? 250, 25)
    distance = 20 * Math.max(0, 1 - x.km / scale)
  }

  const fit = 25 * Math.max(0, Math.min(100, x.compatibility)) / 100

  const r = x.reply
  const replies = !r || r.received < 3 ? 12 : 20 * (r.replied / r.received)

  const profile = (x.hasPhoto ? 7 : 0) + (x.hasBio ? 3 : 0)
  const promotion = (x.boosted ? 15 : 0) + (x.tierRank >= 2 ? 5 : x.tierRank >= 1 ? 3 : 0)

  return activity + distance + fit + replies + profile + promotion
}

/**
 * For each member: in how many conversations someone else messaged them in
 * the last 60 days, and in how many of those they wrote back afterwards.
 */
export async function replyStats(userIds: string[]): Promise<Map<string, { received: number; replied: number }>> {
  const out = new Map<string, { received: number; replied: number }>()
  if (userIds.length === 0) return out
  const rows = await db.$queryRaw<{ uid: string; received: number; replied: number }[]>`
    WITH inbound AS (
      SELECT cp."userId" AS uid, m."conversationId" AS cid, MIN(m."createdAt") AS first_in
        FROM "Message" m
        JOIN "ConversationParticipant" cp ON cp."conversationId" = m."conversationId" AND cp."userId" <> m."senderId"
       WHERE cp."userId" IN (${Prisma.join(userIds)})
         AND m."createdAt" > now() - interval '60 days'
       GROUP BY 1, 2
    )
    SELECT i.uid,
           COUNT(*)::int AS received,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "Message" r
              WHERE r."conversationId" = i.cid AND r."senderId" = i.uid AND r."createdAt" > i.first_in
           ))::int AS replied
      FROM inbound i
     GROUP BY i.uid`
  for (const r of rows) out.set(r.uid, { received: r.received, replied: r.replied })
  return out
}
