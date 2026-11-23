/**
 * Automatic protection (server only).
 *
 * 1. Hidden pending review: when 3 or more different members have open
 *    reports against someone, they're hidden (User.underReviewAt) from browse,
 *    Discover, the Gallery and their profile page, and can't start new chats
 *    or comment, until an admin restores or bans them (Reports page). Their
 *    existing chats keep working, and they're never told who reported them.
 *
 * 2. New-account speed limits: in their first 7 days, members can message at
 *    most 12 different people an hour (40 a day) and comment on 10 photos an
 *    hour. Going over is refused with a friendly "slow down", and the account
 *    is flagged once a day in the Reports queue as an automatic report.
 *
 * Admins and demo profiles are never affected.
 */
import { db } from '@/lib/db'

export const REVIEW_REPORTERS = 3
export const NEW_ACCOUNT_DAYS = 7
export const NEW_CHATS_PER_HOUR = 12
export const NEW_CHATS_PER_DAY = 40
export const NEW_COMMENTS_PER_HOUR = 10

const HOUR = 3600_000
const DAY = 24 * HOUR

export const UNDER_REVIEW_ERROR = 'Your account is being reviewed by our team, so you can’t start new chats or comment for now. You can keep chatting with people you already talk to.'
export const SLOW_DOWN_ERROR = 'You’re reaching out to a lot of people very quickly. New accounts have a limit — please try again a little later.'

export const AUTO_REPORT_KIND = 'AUTO'

type Account = { role: string; isDemo: boolean; createdAt: Date; underReviewAt: Date | null }

async function account(userId: string): Promise<Account | null> {
  return db.user.findUnique({ where: { id: userId }, select: { role: true, isDemo: true, createdAt: true, underReviewAt: true } })
}

function exempt(a: Account): boolean {
  return a.role === 'ADMIN' || a.isDemo
}

function isNew(a: Account, now: number): boolean {
  return now - a.createdAt.getTime() < NEW_ACCOUNT_DAYS * DAY
}

export async function isUnderReview(userId: string): Promise<boolean> {
  const a = await account(userId)
  return !!a?.underReviewAt && !exempt(a)
}

/** Raises an automatic report for the admins (at most once per account per day). */
export async function autoFlag(userId: string, reason: string, now = new Date()) {
  try {
    const recent = await db.notification.findFirst({
      where: {
        type: 'REPORT', createdAt: { gte: new Date(now.getTime() - DAY) },
        AND: [{ data: { path: ['reportedUserId'], equals: userId } }, { data: { path: ['kind'], equals: AUTO_REPORT_KIND } }],
      },
      select: { id: true },
    })
    if (recent) return
    const [admin, u] = await Promise.all([
      db.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
      db.user.findUnique({ where: { id: userId }, select: { username: true } }),
    ])
    if (!admin || !u) return
    await db.notification.create({
      data: {
        userId: admin.id, type: 'REPORT', title: 'Automatic flag',
        body: `@${u.username} was flagged automatically: ${reason}`,
        data: { kind: AUTO_REPORT_KIND, reportedUserId: userId, reason: `Automatic: ${reason}` },
      },
    })
  } catch (e) {
    console.error('autoFlag failed:', e instanceof Error ? e.message : e)
  }
}

/**
 * Before a message is sent: null when fine, else an error to show. Only new
 * accounts are limited, and only when this would be a person they haven't
 * messaged in the window (replies in existing chats are never limited).
 */
export async function messageVelocityProblem(userId: string, conversationId: string, now = Date.now()): Promise<string | null> {
  const a = await account(userId)
  if (!a || exempt(a) || !isNew(a, now)) return null
  const recent = await db.message.groupBy({
    by: ['conversationId'],
    where: { senderId: userId, createdAt: { gte: new Date(now - DAY) } },
    _max: { createdAt: true },
  })
  if (recent.some((r) => r.conversationId === conversationId)) return null
  const lastHour = recent.filter((r) => (r._max.createdAt?.getTime() ?? 0) >= now - HOUR).length
  if (lastHour >= NEW_CHATS_PER_HOUR || recent.length >= NEW_CHATS_PER_DAY) {
    await autoFlag(userId, `new account messaged ${recent.length} different people in 24 hours (${lastHour} in the last hour)`)
    return SLOW_DOWN_ERROR
  }
  return null
}

/** Before a Gallery comment from a new account. */
export async function commentVelocityProblem(userId: string, now = Date.now()): Promise<string | null> {
  const a = await account(userId)
  if (!a || exempt(a) || !isNew(a, now)) return null
  const photos = await db.photoComment.groupBy({ by: ['photoId'], where: { userId, createdAt: { gte: new Date(now - HOUR) } } })
  if (photos.length >= NEW_COMMENTS_PER_HOUR) {
    await autoFlag(userId, `new account commented on ${photos.length} photos in an hour`)
    return 'You’re commenting on a lot of photos very quickly. New accounts have a limit — please try again a little later.'
  }
  return null
}

/** Distinct members with open (unresolved) reports against this person; automatic flags don't count. */
export async function openReporterCount(userId: string): Promise<number> {
  const open = await db.notification.findMany({
    where: { type: 'REPORT', isRead: false, data: { path: ['reportedUserId'], equals: userId } },
    select: { data: true },
  })
  const reporters = new Set<string>()
  for (const n of open) {
    const d = (n.data ?? {}) as { reportedBy?: unknown; kind?: unknown }
    if (d.kind === AUTO_REPORT_KIND) continue
    if (typeof d.reportedBy === 'string') reporters.add(d.reportedBy)
  }
  return reporters.size
}

/** After a report: hide the member pending review once enough different people have reported them. */
export async function reviewAfterReport(userId: string): Promise<boolean> {
  const a = await account(userId)
  if (!a || exempt(a) || a.underReviewAt) return false
  const n = await openReporterCount(userId)
  if (n < REVIEW_REPORTERS) return false
  await db.user.update({ where: { id: userId }, data: { underReviewAt: new Date(), underReviewReason: `Reported by ${n} different members` } })
  return true
}

/** Admin decision: visible again, and the open reports against them are resolved. */
export async function restoreFromReview(userId: string) {
  const now = new Date()
  await db.user.update({ where: { id: userId }, data: { underReviewAt: null, underReviewReason: null } })
  await db.notification.updateMany({
    where: { type: 'REPORT', isRead: false, data: { path: ['reportedUserId'], equals: userId } },
    data: { isRead: true, readAt: now },
  })
}
