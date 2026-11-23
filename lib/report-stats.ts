import { db } from '@/lib/db'

/** How quickly member reports get handled (a report is handled when an admin resolves it: Notification.readAt). */
export const REPORT_TARGET_HOURS = 24

export type ReportStats = {
  open: number
  overdue: number
  oldestOpenHours: number | null
  handled30d: number
  medianHours: number | null
  averageHours: number | null
  withinTargetPct: number | null
}

export async function reportStats(now = new Date()): Promise<ReportStats> {
  const since = new Date(now.getTime() - 30 * 86400000)
  const [open, handled] = await Promise.all([
    db.notification.findMany({ where: { type: 'REPORT', isRead: false }, select: { createdAt: true } }),
    db.notification.findMany({
      where: { type: 'REPORT', isRead: true, readAt: { not: null, gte: since } },
      select: { createdAt: true, readAt: true },
    }),
  ])
  const hrs = (ms: number) => ms / 3600000
  const openAges = open.map((r) => hrs(now.getTime() - r.createdAt.getTime()))
  const took = handled.map((r) => hrs(r.readAt!.getTime() - r.createdAt.getTime())).sort((a, b) => a - b)
  const round = (n: number) => Math.round(n * 10) / 10
  const median = took.length ? (took.length % 2 ? took[(took.length - 1) / 2] : (took[took.length / 2 - 1] + took[took.length / 2]) / 2) : null
  return {
    open: open.length,
    overdue: openAges.filter((h) => h > REPORT_TARGET_HOURS).length,
    oldestOpenHours: openAges.length ? round(Math.max(...openAges)) : null,
    handled30d: took.length,
    medianHours: median === null ? null : round(median),
    averageHours: took.length ? round(took.reduce((a, b) => a + b, 0) / took.length) : null,
    withinTargetPct: took.length ? Math.round((took.filter((h) => h <= REPORT_TARGET_HOURS).length / took.length) * 100) : null,
  }
}
