import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sweepViewOnce } from '@/lib/view-once'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Deletes the stored files of view-once messages that are done: every
 * recipient has opened it and every view window has ended, or it is more than
 * 14 days old. Sets Message.mediaDeletedAt. Idempotent; schedule hourly (the
 * same clean-up also runs lazily when a chat is read and after each opening).
 */
async function handler(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let checked = 0
  let deleted = 0
  // A few batches per run so a backlog clears without one huge query
  for (let i = 0; i < 10; i++) {
    const r = await sweepViewOnce({ limit: 200 })
    checked += r.checked
    deleted += r.deleted
    if (r.checked < 200 || r.deleted === 0) break
  }
  return NextResponse.json({ ok: true, checked, deleted })
}

export async function GET(req: NextRequest) {
  try {
    return await handler(req)
  } catch (error) {
    console.error('GET /api/cron/view-once error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
