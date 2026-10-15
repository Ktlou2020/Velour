import { db } from '@/lib/db'
import { MEMBERSHIP_PRICES } from '@/lib/payfast'

/**
 * Platform analytics for the admin panel. Everything is computed live from the
 * database (no tracking tables); days are bucketed in South African time.
 * Aggregates only: no per-member sensitive data (ethnicity is never reported).
 */

export const ANALYTICS_RANGES = [7, 30, 90, 365] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

export function parseRange(v: unknown): AnalyticsRange {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : 30
}

const DAY_MS = 24 * 60 * 60 * 1000
const TZ = 'Africa/Johannesburg'
const PAID_ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export const SERIES_KEYS = [
  'signups', 'activeChatters', 'messages', 'matches', 'likes', 'profileViews',
  'photoLikes', 'reviews', 'sparkAnswers', 'memberships', 'membershipRevenueCents',
  'storeOrders', 'storeRevenueCents', 'reports', 'blocks',
] as const
export type SeriesKey = (typeof SERIES_KEYS)[number]
export type AnalyticsDay = { date: string } & Record<SeriesKey, number>

export const SERIES_LABELS: Record<SeriesKey, string> = {
  signups: 'New sign-ups',
  activeChatters: 'Members who sent a message',
  messages: 'Messages sent',
  matches: 'Matches',
  likes: 'Likes',
  profileViews: 'Profile views',
  photoLikes: 'Explore photo likes',
  reviews: 'Reviews',
  sparkAnswers: 'Spark answers',
  memberships: 'Membership payments',
  membershipRevenueCents: 'Membership revenue (cents)',
  storeOrders: 'Paid store orders',
  storeRevenueCents: 'Store revenue (cents)',
  reports: 'Reports',
  blocks: 'Blocks',
}

/** YYYY-MM-DD for a Date in SAST. */
function sastDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Midnight SAST `days - 1` days ago, so the range covers whole local days ending today. */
function rangeStart(days: number, now: Date): Date {
  const today = sastDay(now)
  const midnight = new Date(`${today}T00:00:00+02:00`)
  return new Date(midnight.getTime() - (days - 1) * DAY_MS)
}

type Row = { day: string; n: bigint | number | null }

// Table/column names below are fixed literals (never user input).
const DAY_EXPR = (col: string) => `to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}', 'YYYY-MM-DD')`

async function dailyCount(table: string, col: string, from: Date, to: Date, extraWhere = '', value = 'count(*)'): Promise<Map<string, number>> {
  const rows = await db.$queryRawUnsafe<Row[]>(
    `SELECT ${DAY_EXPR(`"${col}"`)} AS day, ${value} AS n FROM "${table}" WHERE "${col}" >= $1 AND "${col}" < $2 ${extraWhere} GROUP BY 1`,
    from,
    to,
  )
  return new Map(rows.map((r) => [r.day, Number(r.n ?? 0)]))
}

function membershipCents(data: unknown): number {
  const d = (data ?? {}) as { amountCents?: unknown; tier?: unknown; itemName?: unknown }
  if (typeof d.amountCents === 'number' && d.amountCents > 0) return d.amountCents
  // Older payments didn't record the amount: estimate from the plan price.
  const tier = d.tier === 'PLATINUM' ? 'PLATINUM' : 'GOLD'
  const annual = typeof d.itemName === 'string' && /annual|year/i.test(d.itemName)
  return Math.round(MEMBERSHIP_PRICES[tier][annual ? 'annual' : 'monthly'] * 100)
}

function sum(series: AnalyticsDay[], key: SeriesKey) {
  return series.reduce((t, d) => t + d[key], 0)
}

export async function getDailySeries(days: number, now = new Date()): Promise<AnalyticsDay[]> {
  const from = rangeStart(days, now)
  const to = new Date(now.getTime() + 60_000)
  return seriesBetween(from, to, days)
}

async function seriesBetween(from: Date, to: Date, days: number): Promise<AnalyticsDay[]> {
  const paidIn = `AND "status" IN (${PAID_ORDER_STATUSES.map((s) => `'${s}'`).join(',')})`
  const [
    signups, activeChatters, messages, matches, likes, profileViews, photoLikes, reviews,
    sparkAnswers, storeOrders, storeRevenueCents, reports, blocks, payments,
  ] = await Promise.all([
    dailyCount('User', 'createdAt', from, to, `AND "role" <> 'ADMIN'`),
    dailyCount('Message', 'createdAt', from, to, '', 'count(DISTINCT "senderId")'),
    dailyCount('Message', 'createdAt', from, to),
    dailyCount('Match', 'createdAt', from, to),
    dailyCount('Like', 'createdAt', from, to),
    dailyCount('ProfileView', 'createdAt', from, to),
    dailyCount('PhotoLike', 'createdAt', from, to),
    dailyCount('Review', 'createdAt', from, to),
    dailyCount('SparkAnswer', 'createdAt', from, to),
    dailyCount('Order', 'paidAt', from, to, paidIn),
    dailyCount('Order', 'paidAt', from, to, paidIn, 'sum("totalCents")'),
    dailyCount('Notification', 'createdAt', from, to, `AND "type" = 'REPORT'`),
    dailyCount('Block', 'createdAt', from, to),
    db.notification.findMany({
      where: { type: 'PAYMENT', createdAt: { gte: from, lt: to } },
      select: { createdAt: true, data: true },
    }),
  ])

  const memberships = new Map<string, number>()
  const membershipRevenueCents = new Map<string, number>()
  for (const p of payments) {
    const day = sastDay(p.createdAt)
    memberships.set(day, (memberships.get(day) ?? 0) + 1)
    membershipRevenueCents.set(day, (membershipRevenueCents.get(day) ?? 0) + membershipCents(p.data))
  }

  const maps: Record<SeriesKey, Map<string, number>> = {
    signups, activeChatters, messages, matches, likes, profileViews, photoLikes, reviews,
    sparkAnswers, memberships, membershipRevenueCents, storeOrders, storeRevenueCents, reports, blocks,
  }
  const out: AnalyticsDay[] = []
  for (let i = 0; i < days; i++) {
    const date = sastDay(new Date(from.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000))
    const day = { date } as AnalyticsDay
    for (const k of SERIES_KEYS) day[k] = maps[k].get(date) ?? 0
    out.push(day)
  }
  return out
}

export type Breakdown = { label: string; count: number }[]

const GENDER_LABEL: Record<string, string> = { MAN: 'Men', WOMAN: 'Women', NON_BINARY: 'Non-binary', OTHER: 'Other' }
const TIER_LABEL: Record<string, string> = { FREE: 'Free', GOLD: 'Gold', PLATINUM: 'Platinum' }

function pretty(v: string | null | undefined) {
  if (!v) return 'Not set'
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/_/g, ' ')
}

export async function getAdminAnalytics(days: AnalyticsRange, now = new Date()) {
  const from = rangeStart(days, now)
  const to = new Date(now.getTime() + 60_000)
  const prevFrom = new Date(from.getTime() - days * DAY_MS)
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS)
  const notAdmin = { role: { not: 'ADMIN' } }
  const cohort = { createdAt: { gte: from, lt: to } }

  const [
    series, previous,
    totalMembers, activeAccounts, banned, emailVerified, photoVerified, couples, onlineNow,
    dau, wau, mau,
    genderRows, orientationRows, tierRows, cityRows, ageRows,
    funnelPhoto, funnelComplete, funnelMessaged, funnelMatched, funnelPaid,
    retained1, cohort1, retained7, cohort7,
    pendingOrders, topProducts, topViewed, pendingVerification, unreadReports, hiddenReviews,
    admins, chattersRows,
  ] = await Promise.all([
    seriesBetween(from, to, days),
    seriesBetween(prevFrom, from, days),

    db.user.count({ where: notAdmin }),
    db.user.count({ where: { ...notAdmin, isActive: true } }),
    db.user.count({ where: { isActive: false } }),
    db.user.count({ where: { ...notAdmin, isVerified: true } }),
    db.user.count({ where: { ...notAdmin, verificationStatus: 'APPROVED' } }),
    db.profile.count({ where: { isCouple: true, user: notAdmin } }),
    db.profile.count({ where: { isOnline: true, lastSeen: { gte: new Date(now.getTime() - 15 * 60_000) } } }),

    db.profile.count({ where: { lastSeen: { gte: dayAgo }, user: notAdmin } }),
    db.profile.count({ where: { lastSeen: { gte: weekAgo }, user: notAdmin } }),
    db.profile.count({ where: { lastSeen: { gte: monthAgo }, user: notAdmin } }),

    db.profile.groupBy({ by: ['gender'], where: { user: notAdmin }, _count: { _all: true } }),
    db.profile.groupBy({ by: ['orientation'], where: { user: notAdmin }, _count: { _all: true } }),
    db.profile.groupBy({ by: ['membershipTier'], where: { user: notAdmin }, _count: { _all: true } }),
    db.profile.groupBy({
      by: ['city'],
      where: { user: notAdmin, city: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { city: 'desc' } },
      take: 8,
    }),
    db.$queryRawUnsafe<{ band: string; n: bigint }[]>(
      `SELECT CASE
          WHEN a < 25 THEN '18–24' WHEN a < 35 THEN '25–34' WHEN a < 45 THEN '35–44'
          WHEN a < 55 THEN '45–54' ELSE '55+' END AS band, count(*) AS n
        FROM (SELECT date_part('year', age(p."dateOfBirth")) AS a FROM "Profile" p
              JOIN "User" u ON u.id = p."userId"
              WHERE p."dateOfBirth" IS NOT NULL AND u.role <> 'ADMIN') t
        GROUP BY 1`,
    ),

    db.user.count({ where: { ...cohort, ...notAdmin, profile: { profilePhoto: { not: null } } } }),
    db.user.count({ where: { ...cohort, ...notAdmin, profile: { profileCompleteness: { gte: 70 } } } }),
    db.user.count({ where: { ...cohort, ...notAdmin, messagesSent: { some: {} } } }),
    db.user.count({ where: { ...cohort, ...notAdmin, OR: [{ matchesA: { some: {} } }, { matchesB: { some: {} } }] } }),
    db.user.count({ where: { ...cohort, ...notAdmin, profile: { membershipTier: { in: ['GOLD', 'PLATINUM'] } } } }),

    retention(from, now, 1, true),
    retention(from, now, 1, false),
    retention(from, now, 7, true),
    retention(from, now, 7, false),

    db.order.count({ where: { status: 'PENDING_PAYMENT', createdAt: { gte: from } } }),
    db.orderItem.groupBy({
      by: ['name'],
      where: { order: { status: { in: PAID_ORDER_STATUSES }, paidAt: { gte: from, lt: to } } },
      _sum: { quantity: true, priceCents: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    db.profileView.groupBy({
      by: ['viewedId'],
      where: { createdAt: { gte: from, lt: to } },
      _count: { _all: true },
      orderBy: { _count: { viewedId: 'desc' } },
      take: 5,
    }),
    db.verificationRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
    db.notification.count({ where: { type: 'REPORT', isRead: false } }),
    db.review.count({ where: { isHidden: true } }),
    db.user.count({ where: { role: 'ADMIN' } }),
    db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(DISTINCT "senderId") AS n FROM "Message" WHERE "createdAt" >= $1 AND "createdAt" < $2`,
      from,
      to,
    ),
  ])
  const chatters = Number(chattersRows[0]?.n ?? 0)

  const viewedUsers = topViewed.length
    ? await db.user.findMany({
        where: { id: { in: topViewed.map((t) => t.viewedId) } },
        select: { id: true, username: true, profile: { select: { displayName: true } } },
      })
    : []
  const viewedName = new Map(viewedUsers.map((u) => [u.id, u]))

  const totals = Object.fromEntries(SERIES_KEYS.map((k) => [k, sum(series, k)])) as Record<SeriesKey, number>
  const prevTotals = Object.fromEntries(SERIES_KEYS.map((k) => [k, sum(previous, k)])) as Record<SeriesKey, number>

  const tiers: Breakdown = ['FREE', 'GOLD', 'PLATINUM'].map((t) => ({
    label: TIER_LABEL[t],
    count: tierRows.find((r) => r.membershipTier === t)?._count._all ?? 0,
  }))
  const paying = tiers[1].count + tiers[2].count
  const ageOrder = ['18–24', '25–34', '35–44', '45–54', '55+']

  return {
    days,
    from: sastDay(from),
    generatedAt: now.toISOString(),
    series,
    totals,
    prevTotals,
    members: {
      total: totalMembers,
      active: activeAccounts,
      banned,
      emailVerified,
      photoVerified,
      couples,
      singles: Math.max(0, totalMembers - couples),
      onlineNow,
      dau, wau, mau,
      stickiness: mau > 0 ? Math.round((dau / mau) * 100) : 0,
      admins,
    },
    breakdowns: {
      gender: genderRows
        .map((r) => ({ label: r.gender ? GENDER_LABEL[r.gender] ?? r.gender : 'Not set', count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      orientation: orientationRows
        .map((r) => ({ label: pretty(r.orientation), count: r._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      accountType: [
        { label: 'Singles', count: Math.max(0, totalMembers - couples) },
        { label: 'Couples', count: couples },
      ],
      age: ageOrder.map((band) => ({ label: band, count: Number(ageRows.find((r) => r.band === band)?.n ?? 0) })),
      cities: cityRows.map((r) => ({ label: r.city ?? 'Not set', count: r._count._all })),
      tiers,
    },
    funnel: [
      { label: 'Signed up', count: totals.signups },
      { label: 'Added a photo', count: funnelPhoto },
      { label: 'Profile 70%+ complete', count: funnelComplete },
      { label: 'Sent a message', count: funnelMessaged },
      { label: 'Got a match', count: funnelMatched },
      { label: 'Upgraded (Gold/Platinum)', count: funnelPaid },
    ],
    retention: {
      day1: { returned: retained1, cohort: cohort1 },
      day7: { returned: retained7, cohort: cohort7 },
    },
    revenue: {
      membershipCents: totals.membershipRevenueCents,
      storeCents: totals.storeRevenueCents,
      totalCents: totals.membershipRevenueCents + totals.storeRevenueCents,
      prevTotalCents: prevTotals.membershipRevenueCents + prevTotals.storeRevenueCents,
      avgOrderCents: totals.storeOrders > 0 ? Math.round(totals.storeRevenueCents / totals.storeOrders) : 0,
      payingMembers: paying,
      conversionPct: totalMembers > 0 ? Math.round((paying / totalMembers) * 1000) / 10 : 0,
      pendingOrders,
      topProducts: topProducts.map((p) => ({
        name: p.name,
        units: p._sum.quantity ?? 0,
      })),
    },
    engagement: {
      chatters,
      messagesPerChatter: chatters > 0 ? Math.round((totals.messages / chatters) * 10) / 10 : 0,
      topViewed: topViewed.map((t) => {
        const u = viewedName.get(t.viewedId)
        return { username: u?.username ?? 'deleted', name: u?.profile?.displayName ?? u?.username ?? 'Deleted member', views: t._count._all }
      }),
    },
    safety: {
      reports: totals.reports,
      blocks: totals.blocks,
      unreadReports,
      pendingVerification,
      hiddenReviews,
      banned,
    },
  }
}

export type AdminAnalytics = Awaited<ReturnType<typeof getAdminAnalytics>>

/**
 * Members who signed up in the range at least `afterDays` ago: either the
 * cohort size, or how many of them were seen again `afterDays`+ after joining.
 */
async function retention(from: Date, now: Date, afterDays: number, returnedOnly: boolean): Promise<number> {
  const cutoff = new Date(now.getTime() - afterDays * DAY_MS)
  if (cutoff <= from) return 0
  const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "User" u JOIN "Profile" p ON p."userId" = u.id
      WHERE u.role <> 'ADMIN' AND u."createdAt" >= $1 AND u."createdAt" < $2
      ${returnedOnly ? `AND p."lastSeen" >= u."createdAt" + interval '${afterDays} days'` : ''}`,
    from,
    cutoff,
  )
  return Number(rows[0]?.n ?? 0)
}

export function seriesToCsv(series: AnalyticsDay[]): string {
  const header = ['date', ...SERIES_KEYS].join(',')
  const lines = series.map((d) => [d.date, ...SERIES_KEYS.map((k) => d[k])].join(','))
  return [header, ...lines].join('\n') + '\n'
}
