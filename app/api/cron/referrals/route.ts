import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sweepReferrals } from '@/lib/referrals'

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
 * Invite-a-friend sweep (schedule hourly; idempotent): rewards PENDING
 * referrals whose invited member has confirmed their email and set a main
 * photo but wasn't rewarded by the event hooks (or was over the monthly cap
 * then), and rejects referrals involving deactivated accounts.
 */
async function handler(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await sweepReferrals()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('cron/referrals error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
