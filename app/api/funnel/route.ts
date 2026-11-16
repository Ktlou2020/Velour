import { NextRequest, NextResponse } from 'next/server'
import { FUNNEL_STEPS, isBotUserAgent, recordFunnelStep, type FunnelStep } from '@/lib/funnel'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/funnel { step } — anonymous top-of-funnel beacon (site visit,
 * sign-up page opened). The browser sends each step at most once a day;
 * bots and floods are dropped. Always answers 204 so it never shows errors.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { step?: unknown } | null
    const step = body?.step
    if (typeof step !== 'string' || !(FUNNEL_STEPS as readonly string[]).includes(step)) return new NextResponse(null, { status: 204 })
    if (isBotUserAgent(req.headers.get('user-agent'))) return new NextResponse(null, { status: 204 })
    if (!rateLimit(`funnel:${getClientIp(req.headers)}:${step}`, 100, 24 * 60 * 60 * 1000)) return new NextResponse(null, { status: 204 })
    await recordFunnelStep(step as FunnelStep)
  } catch (e) {
    console.error('POST /api/funnel error:', e instanceof Error ? e.message : e)
  }
  return new NextResponse(null, { status: 204 })
}
