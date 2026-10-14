// Shared allowance logic (likes, super likes, priority messages) used by
// /api/likes, /api/likes/allowance, /api/likes/undo and the subscription page.
// Not a route file (Next only treats route.ts as a route).
import { db } from '@/lib/db'
import { entitlements, messageLimitFor, planFor, startOfDaySAST, startOfWeekSAST, type Entitlements, type PlanTier } from '@/lib/plans'

const DAY_MS = 24 * 60 * 60 * 1000

/** Like types that count toward the daily like allowance (PASS never counts). */
export const COUNTED_LIKE_TYPES = ['LIKE', 'WINK', 'SUPERLIKE'] as const

export interface Allowance {
  tier: PlanTier
  likes: { limit: number | null; used: number; remaining: number | null; resetsAt: string }
  superLikes: {
    limit: number
    period: 'day' | 'week'
    used: number
    /** Left in this period's plan allowance. */
    remaining: number
    /** Bonus credits (login-streak rewards), spent only once the period allowance is used up. */
    bonus: number
    /** remaining + bonus */
    available: number
    resetsAt: string
  }
  priorityMessages: { limit: number | null; used: number; remaining: number | null; resetsAt: string }
  /** Messages of any kind sent in the rolling last 24 hours. resetsAt = when the oldest one ages out (null if none). */
  messages: { limit: number | null; used: number; remaining: number | null; resetsAt: string | null; /** New-member welcome period: unlimited until then. */ welcomeUntil: string | null }
  features: Entitlements
}

export function dayResetsAt(now = new Date()): Date {
  return new Date(startOfDaySAST(now).getTime() + DAY_MS)
}

export function weekResetsAt(now = new Date()): Date {
  return new Date(startOfWeekSAST(now).getTime() + 7 * DAY_MS)
}

export function superLikePeriodStart(ent: Entitlements, now = new Date()): Date {
  return ent.superLikePeriod === 'day' ? startOfDaySAST(now) : startOfWeekSAST(now)
}

export function superLikeResetsAt(ent: Entitlements, now = new Date()): Date {
  return ent.superLikePeriod === 'day' ? dayResetsAt(now) : weekResetsAt(now)
}

export async function loadPlan(userId: string): Promise<{ tier: PlanTier; role: string | null; ent: Entitlements; bonus: number; createdAt: Date }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, superLikeCredits: true, createdAt: true, profile: { select: { membershipTier: true } } },
  })
  const tier = planFor(u?.profile?.membershipTier, u?.role)
  return { tier, role: u?.role ?? null, ent: entitlements(tier), bonus: Math.max(0, u?.superLikeCredits ?? 0), createdAt: u?.createdAt ?? new Date() }
}

export async function countLikesToday(userId: string, now = new Date()): Promise<number> {
  return db.like.count({
    where: { fromUserId: userId, type: { in: [...COUNTED_LIKE_TYPES] }, createdAt: { gte: startOfDaySAST(now) } },
  })
}

export async function countSuperLikesInPeriod(userId: string, ent: Entitlements, now = new Date()): Promise<number> {
  return db.like.count({
    where: { fromUserId: userId, type: 'SUPERLIKE', createdAt: { gte: superLikePeriodStart(ent, now) } },
  })
}

export async function countPriorityMessagesThisWeek(userId: string, now = new Date()): Promise<number> {
  return db.message.count({
    where: { senderId: userId, isPriority: true, createdAt: { gte: startOfWeekSAST(now) } },
  })
}

/** Messages of any kind (text, photos, videos, voice notes, games) the user sent in the rolling last 24 hours (+ the oldest one's time). */
export async function messagesInLast24h(userId: string, now = new Date()): Promise<{ used: number; oldest: Date | null }> {
  const where = { senderId: userId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } }
  const [used, oldest] = await Promise.all([
    db.message.count({ where }),
    db.message.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ])
  return { used, oldest: oldest?.createdAt ?? null }
}

export async function getAllowance(userId: string): Promise<Allowance> {
  const now = new Date()
  const { tier, role, ent, bonus, createdAt } = await loadPlan(userId)
  const msgLimit = messageLimitFor(tier, role, createdAt, now)
  const [likesUsed, superUsed, priorityUsed, msgs] = await Promise.all([
    countLikesToday(userId, now),
    countSuperLikesInPeriod(userId, ent, now),
    countPriorityMessagesThisWeek(userId, now),
    messagesInLast24h(userId, now),
  ])
  const superRemaining = Math.max(0, ent.superLikes - superUsed)
  return {
    tier,
    likes: {
      limit: ent.likesPerDay,
      used: likesUsed,
      remaining: ent.likesPerDay === null ? null : Math.max(0, ent.likesPerDay - likesUsed),
      resetsAt: dayResetsAt(now).toISOString(),
    },
    superLikes: {
      limit: ent.superLikes,
      period: ent.superLikePeriod,
      used: superUsed,
      remaining: superRemaining,
      bonus,
      available: superRemaining + bonus,
      resetsAt: superLikeResetsAt(ent, now).toISOString(),
    },
    priorityMessages: {
      limit: ent.priorityMessagesPerWeek,
      used: priorityUsed,
      remaining: ent.priorityMessagesPerWeek === null ? null : Math.max(0, ent.priorityMessagesPerWeek - priorityUsed),
      resetsAt: weekResetsAt(now).toISOString(),
    },
    messages: {
      limit: msgLimit.limit,
      used: msgs.used,
      remaining: msgLimit.limit === null ? null : Math.max(0, msgLimit.limit - msgs.used),
      resetsAt: msgs.oldest ? new Date(msgs.oldest.getTime() + DAY_MS).toISOString() : null,
      welcomeUntil: msgLimit.welcomeUntil ? msgLimit.welcomeUntil.toISOString() : null,
    },
    features: ent,
  }
}
