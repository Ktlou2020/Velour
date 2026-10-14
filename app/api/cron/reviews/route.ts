import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { expireRequests, publishDueReviews, recomputeRating } from '@/lib/reviews'

export const dynamic = 'force-dynamic'

const RESYNC_MAX = 2000

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Reviews housekeeping (schedule hourly or daily — see README):
 *  - PENDING review requests past expiresAt → EXPIRED
 *  - hidden reviews older than 14 days → published (reviewee notified)
 *  - re-sync Profile.ratingAvg / ratingCount for everyone with reviews
 *    (safety net, e.g. after a reviewer deleted their account)
 * The same expiry/publish steps also run lazily whenever reviews are read.
 */
async function handler(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const now = new Date()
    const expired = await expireRequests(now)
    const published = await publishDueReviews(now, 1000)
    const [withReviews, withScore] = await Promise.all([
      db.review.findMany({ where: { publishedAt: { not: null } }, distinct: ['revieweeId'], select: { revieweeId: true }, take: RESYNC_MAX }),
      db.profile.findMany({ where: { ratingCount: { gt: 0 } }, select: { userId: true }, take: RESYNC_MAX }),
    ])
    const ids = new Set([...withReviews.map((r) => r.revieweeId), ...withScore.map((p) => p.userId)])
    for (const id of ids) await recomputeRating(id)
    return NextResponse.json({ ok: true, expired, published, resynced: ids.size })
  } catch (error) {
    console.error('cron/reviews error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
