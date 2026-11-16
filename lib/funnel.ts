import { db } from '@/lib/db'

/** Top-of-funnel steps counted by the browser beacon (components/FunnelBeacon.tsx). */
export const FUNNEL_STEPS = ['visit', 'signup_page'] as const
export type FunnelStep = (typeof FUNNEL_STEPS)[number]

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless|lighthouse/i

export function isBotUserAgent(ua: string | null): boolean {
  return !ua || BOT_UA.test(ua)
}

/** Today's date in SAST as a UTC-midnight Date (the @db.Date key). */
export function sastDay(now = new Date()): Date {
  const d = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function recordFunnelStep(step: FunnelStep, now = new Date()): Promise<void> {
  const day = sastDay(now)
  await db.funnelDaily.upsert({
    where: { day_step: { day, step } },
    update: { count: { increment: 1 } },
    create: { day, step, count: 1 },
  })
}

/** Total for a step over [from, to) (SAST days). */
export async function funnelTotal(step: FunnelStep, from: Date, to: Date): Promise<number> {
  const r = await db.funnelDaily.aggregate({
    where: { step, day: { gte: sastDay(from), lte: sastDay(to) } },
    _sum: { count: true },
  })
  return r._sum.count ?? 0
}
