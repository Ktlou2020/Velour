import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAllowance } from '../limits'

/**
 * GET /api/likes/allowance — the caller's live plan allowances:
 * likes left today, super likes left this period (+ bonus credits),
 * priority messages left this week, and the plan's feature flags.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const allowance = await getAllowance(session.user.id)
    return NextResponse.json(allowance, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/likes/allowance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
