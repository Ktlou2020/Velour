/**
 * Priority messages (server only): pinned to the top of the recipient's inbox.
 * Free 0 / Gold 3 per week / Platinum unlimited (see lib/plans.ts), counted per
 * account (a shared couple account shares one allowance) from Monday 00:00
 * SAST, and at most one per conversation per SAST day to avoid spam.
 */
import { db } from '@/lib/db'
import { entitlements, messageLimitFor, planFor, startOfDaySAST, startOfWeekSAST, type PlanTier } from '@/lib/plans'

export interface PriorityAllowance {
  plan: PlanTier
  /** null = unlimited */
  limit: number | null
  used: number
  /** null = unlimited */
  remaining: number | null
  /** Already sent a priority message in this conversation today (when asked about one) */
  usedInConversationToday?: boolean
  /** When the weekly allowance resets (next Monday 00:00 SAST) */
  resetsAt: string
}

export async function getPriorityAllowance(userId: string, conversationId?: string | null): Promise<PriorityAllowance> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { membershipTier: true } } },
  })
  const plan = planFor(user?.profile?.membershipTier, user?.role)
  const limit = entitlements(plan).priorityMessagesPerWeek
  const weekStart = startOfWeekSAST()
  const [used, today] = await Promise.all([
    limit === 0
      ? Promise.resolve(0)
      : db.message.count({ where: { senderId: userId, isPriority: true, createdAt: { gte: weekStart } } }),
    conversationId
      ? db.message.findFirst({
          where: { senderId: userId, conversationId, isPriority: true, createdAt: { gte: startOfDaySAST() } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  return {
    plan,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    ...(conversationId ? { usedInConversationToday: !!today } : {}),
    resetsAt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

export type PriorityCheck =
  | { ok: true }
  | { ok: false; status: number; error: string; upgrade?: boolean; allowance: PriorityAllowance }

/** May `userId` send a priority message in `conversationId` right now? */
export async function checkPriority(userId: string, conversationId: string): Promise<PriorityCheck> {
  const allowance = await getPriorityAllowance(userId, conversationId)
  if (allowance.limit === 0) {
    return { ok: false, status: 403, upgrade: true, error: 'Priority messages are a Gold & Platinum feature', allowance }
  }
  if (allowance.usedInConversationToday) {
    return { ok: false, status: 429, error: 'You can send one priority message per conversation per day', allowance }
  }
  if (allowance.remaining !== null && allowance.remaining <= 0) {
    return {
      ok: false,
      status: 429,
      upgrade: allowance.plan !== 'PLATINUM',
      error: 'You have used all your priority messages this week',
      allowance,
    }
  }
  return { ok: true }
}

// ── Free plan: messages per rolling 24 hours ────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000
const MB = 1024 * 1024

/** Chat video upload cap per plan (bytes). The request is buffered in memory, so keep these modest. */
export const CHAT_VIDEO_MAX_BYTES: Record<PlanTier, number> = { FREE: 15 * MB, GOLD: 60 * MB, PLATINUM: 100 * MB }

export interface MessageAllowance {
  /** null = unlimited */
  limit: number | null
  /** null = unlimited */
  remaining: number | null
  /** When the next message slot frees up (oldest counted message turns 24h old); null if nothing is counted */
  resetsAt: string | null
  /** New members: unlimited messages until this time (then the Free limit applies) */
  welcomeUntil: string | null
}

/**
 * Messages this account sent in the last 24 hours (rolling). Every created
 * message counts (text, photo, voice, video, new game); game answers and
 * reactions update existing rows and don't.
 */
export async function getMessageAllowance(userId: string, now = new Date()): Promise<MessageAllowance> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, createdAt: true, profile: { select: { membershipTier: true } } },
  })
  const { limit, welcomeUntil } = messageLimitFor(user?.profile?.membershipTier, user?.role, user?.createdAt ?? now, now)
  if (limit === null) return { limit: null, remaining: null, resetsAt: null, welcomeUntil: welcomeUntil?.toISOString() ?? null }
  const recent = await db.message.findMany({
    where: { senderId: userId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
    take: 500,
  })
  const used = recent.length
  const remaining = Math.max(0, limit - used)
  // With `used` messages and a cap of `limit`, the next send is possible once message [used - limit] is 24h old.
  const idx = remaining > 0 ? 0 : used - limit
  const resetsAt = recent[idx] ? new Date(recent[idx].createdAt.getTime() + DAY_MS).toISOString() : null
  return { limit, remaining, resetsAt, welcomeUntil: null }
}

/** The 429 body for an exhausted message allowance. */
export function messageLimitError(a: MessageAllowance) {
  const at = a.resetsAt ? clockSAST(a.resetsAt) : null
  return {
    error: `You've sent your ${a.limit} free messages for now.${at ? ` Your next one unlocks at ${at}.` : ''}`,
    limit: a.limit,
    remaining: 0,
    resetsAt: a.resetsAt,
    upgrade: true,
    quota: true,
  }
}

/** Chat video rules for this account: max seconds and max bytes. */
export async function chatVideoRules(userId: string): Promise<{ plan: PlanTier; maxSec: number; maxBytes: number }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, profile: { select: { membershipTier: true } } } })
  const plan = planFor(user?.profile?.membershipTier, user?.role)
  return { plan, maxSec: entitlements(plan).chatVideoMaxSec, maxBytes: CHAT_VIDEO_MAX_BYTES[plan] }
}

/** "21:40" in South African time. */
export function clockSAST(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' }).format(new Date(iso))
}
