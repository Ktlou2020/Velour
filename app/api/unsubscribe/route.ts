import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyUnsubscribeToken } from '@/lib/lifecycle-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Signed, login-free email opt-out for lifecycle emails (likes, messages, tips).
 *  - JSON  POST { u, t, resubscribe? }       — from the /unsubscribe page
 *  - RFC 8058 one-click POST ?u=…&t=…         — from the List-Unsubscribe header
 *    (body "List-Unsubscribe=One-Click", form-encoded)
 * Transactional email (password reset, receipts) is unaffected.
 */
export async function POST(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams
    let u: unknown = qs.get('u')
    let t: unknown = qs.get('t')
    let resubscribe = false
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as { u?: unknown; t?: unknown; resubscribe?: unknown }
      u = body.u ?? u
      t = body.t ?? t
      resubscribe = body.resubscribe === true
    }
    if (!verifyUnsubscribeToken(u, t)) {
      return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 })
    }
    const res = await db.user.updateMany({
      where: { id: u as string },
      data: { emailMarketingOptOut: !resubscribe },
    })
    if (res.count === 0) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 })
    return NextResponse.json({ ok: true, optedOut: !resubscribe })
  } catch (error) {
    console.error('POST /api/unsubscribe error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
