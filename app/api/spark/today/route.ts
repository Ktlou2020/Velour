import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { loadTodayStatus } from '../data'

export const dynamic = 'force-dynamic'

/** GET /api/spark/today — lightweight: today's question and whether I've answered (nav dot). */
export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { today, myAnswer, count } = await loadTodayStatus(userId)
    return NextResponse.json(
      { question: today.question, dateKey: today.dateKey, closesAt: today.closesAt, answered: !!myAnswer, myAnswer, count },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('GET /api/spark/today error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
