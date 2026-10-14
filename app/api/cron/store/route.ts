import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { releaseExpiredOrders } from '@/lib/store/orders'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Store housekeeping: cancels unpaid orders older than the reservation window
 * (30 min) and returns their stock. Idempotent — each order is claimed with a
 * conditional status update. Schedule every 10–15 minutes (see README); store
 * pages also run it lazily.
 */
export async function GET(req: NextRequest) {
  try {
    if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
    if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const result = await releaseExpiredOrders(500)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('GET /api/cron/store error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
