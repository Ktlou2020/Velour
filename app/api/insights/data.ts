// Profile insights (Platinum) — shared by GET /api/insights and the /insights page.
// Not a route file.
import { db } from '@/lib/db'
import { startOfDaySAST } from '@/lib/plans'
import { isBoosted, nextBoostAvailableAt } from '@/lib/premium'
import { getBlockedIds } from '@/app/api/members/search'

const DAY_MS = 24 * 60 * 60 * 1000
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000
export const INSIGHT_DAYS = 30
const ROW_CAP = 20000

export interface InsightDay {
  /** YYYY-MM-DD (SAST) */
  date: string
  views: number
  likes: number
  matches: number
  messages: number
}

export interface Insights {
  days: number
  series: InsightDay[]
  totals: { views: number; uniqueViewers: number; likes: number; matches: number; messages: number }
  /** Previous 30-day window, for "vs last month" deltas. */
  previous: { views: number; likes: number; matches: number; messages: number }
  topCities: { city: string; count: number }[]
  /** Activity (views + likes + messages received) by SAST weekday, Monday first. */
  byWeekday: { day: string; count: number }[]
  /** Activity by SAST 3-hour window. */
  byHour: { label: string; count: number }[]
  bestDay: string | null
  bestTime: string | null
  boost: { active: boolean; boostedUntil: string | null; nextAvailableAt: string | null; everyDays: number | null }
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOUR_LABELS = ['00–03', '03–06', '06–09', '09–12', '12–15', '15–18', '18–21', '21–24']
const HOUR_PHRASES = ['after midnight', 'in the early hours', 'in the early morning', 'in the late morning', 'over lunch', 'in the afternoon', 'in the evening', 'late at night']

function sastDateKey(d: Date): string {
  return new Date(d.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10)
}

export async function getInsights(userId: string, opts: { tier: Parameters<typeof nextBoostAvailableAt>[1]; role?: string | null; boostEveryDays: number | null }): Promise<Insights> {
  const now = new Date()
  const start = new Date(startOfDaySAST(now).getTime() - (INSIGHT_DAYS - 1) * DAY_MS)
  const prevStart = new Date(start.getTime() - INSIGHT_DAYS * DAY_MS)
  const blocked = await getBlockedIds(userId)

  const [views, likes, matches, messages, prevViews, prevLikes, prevMatches, prevMessages, profile] = await Promise.all([
    db.profileView.findMany({
      where: { viewedId: userId, createdAt: { gte: start }, viewerId: { notIn: blocked } },
      select: { createdAt: true, viewerId: true, viewer: { select: { profile: { select: { city: true } } } } },
      take: ROW_CAP,
    }),
    db.like.findMany({
      where: { toUserId: userId, type: { not: 'PASS' }, createdAt: { gte: start }, fromUserId: { notIn: blocked } },
      select: { createdAt: true },
      take: ROW_CAP,
    }),
    db.match.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }], createdAt: { gte: start } },
      select: { createdAt: true },
      take: ROW_CAP,
    }),
    db.message.findMany({
      where: {
        createdAt: { gte: start },
        senderId: { not: userId, notIn: blocked },
        conversation: { participants: { some: { userId } } },
      },
      select: { createdAt: true },
      take: ROW_CAP,
    }),
    db.profileView.count({ where: { viewedId: userId, createdAt: { gte: prevStart, lt: start } } }),
    db.like.count({ where: { toUserId: userId, type: { not: 'PASS' }, createdAt: { gte: prevStart, lt: start } } }),
    db.match.count({ where: { OR: [{ user1Id: userId }, { user2Id: userId }], createdAt: { gte: prevStart, lt: start } } }),
    db.message.count({
      where: { createdAt: { gte: prevStart, lt: start }, senderId: { not: userId }, conversation: { participants: { some: { userId } } } },
    }),
    db.profile.findUnique({ where: { userId }, select: { boostedUntil: true, lastBoostAt: true } }),
  ])

  const series: InsightDay[] = Array.from({ length: INSIGHT_DAYS }, (_, i) => ({
    date: sastDateKey(new Date(start.getTime() + i * DAY_MS)),
    views: 0, likes: 0, matches: 0, messages: 0,
  }))
  const index = new Map(series.map((d, i) => [d.date, i]))
  const bump = (d: Date, key: keyof Omit<InsightDay, 'date'>) => {
    const i = index.get(sastDateKey(d))
    if (i !== undefined) series[i][key]++
  }
  views.forEach((v) => bump(v.createdAt, 'views'))
  likes.forEach((l) => bump(l.createdAt, 'likes'))
  matches.forEach((m) => bump(m.createdAt, 'matches'))
  messages.forEach((m) => bump(m.createdAt, 'messages'))

  const cityCounts = new Map<string, number>()
  for (const v of views) {
    const c = v.viewer.profile?.city?.trim()
    if (c) cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1)
  }
  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }))

  const weekday = new Array(7).fill(0) as number[]
  const hours = new Array(8).fill(0) as number[]
  for (const d of [...views, ...likes, ...messages].map((x) => x.createdAt)) {
    const local = new Date(d.getTime() + SAST_OFFSET_MS)
    weekday[(local.getUTCDay() + 6) % 7]++
    hours[Math.floor(local.getUTCHours() / 3)]++
  }
  const maxIdx = (arr: number[]) => arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0)
  const activity = weekday.reduce((a, b) => a + b, 0)

  const nextAt = opts.boostEveryDays === null ? null : nextBoostAvailableAt(profile?.lastBoostAt, opts.tier, opts.role)
  return {
    days: INSIGHT_DAYS,
    series,
    totals: {
      views: views.length,
      uniqueViewers: new Set(views.map((v) => v.viewerId)).size,
      likes: likes.length,
      matches: matches.length,
      messages: messages.length,
    },
    previous: { views: prevViews, likes: prevLikes, matches: prevMatches, messages: prevMessages },
    topCities,
    byWeekday: WEEKDAYS.map((day, i) => ({ day, count: weekday[i] })),
    byHour: HOUR_LABELS.map((label, i) => ({ label, count: hours[i] })),
    bestDay: activity ? WEEKDAYS[maxIdx(weekday)] : null,
    bestTime: activity ? HOUR_PHRASES[maxIdx(hours)] : null,
    boost: {
      active: isBoosted(profile?.boostedUntil),
      boostedUntil: isBoosted(profile?.boostedUntil) ? profile!.boostedUntil!.toISOString() : null,
      nextAvailableAt: nextAt && nextAt.getTime() > now.getTime() ? nextAt.toISOString() : null,
      everyDays: opts.boostEveryDays,
    },
  }
}
