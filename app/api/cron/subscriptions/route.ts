import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { expireDue, sendEndingReminders, sendPastDueReminders } from '@/lib/subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
 * Membership housekeeping (schedule hourly; idempotent):
 *  - subscriptions past currentPeriodEnd + 3-day grace (cancelled, past due, or
 *    simply not renewed) → EXPIRED, member moved to Free (never admins, never
 *    members without a Subscription row, never a tier an admin changed since)
 *  - "renews in 3 days" for annual plans / "ends in 3 days" for memberships
 *    that won't renew — once per period
 *  - reminders for past-due renewals, at most every 48 hours
 */
async function handler(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const now = new Date()
    const expired = await expireDue(now)
    const reminders = await sendEndingReminders(now)
    const pastDueReminders = await sendPastDueReminders(now)
    return NextResponse.json({ ok: true, ...expired, reminders, pastDueReminders })
  } catch (error) {
    console.error('cron/subscriptions error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
