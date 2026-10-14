import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { loadPlan } from '@/app/api/likes/limits'
import { getInsights } from './data'

/** GET /api/insights — Platinum profile insights (last 30 days). 403 for other plans. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const plan = await loadPlan(session.user.id)
    if (!plan.ent.profileInsights) {
      return NextResponse.json({ error: 'Profile insights are part of Platinum.', upgrade: true }, { status: 403 })
    }
    const insights = await getInsights(session.user.id, { tier: plan.tier, role: plan.role, boostEveryDays: plan.ent.boostEveryDays })
    return NextResponse.json(insights, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/insights error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
