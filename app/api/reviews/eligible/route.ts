import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isValidId } from '@/lib/security'
import { eligiblePeople } from '@/lib/reviews-overview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews/eligible[?conversationId=…] — people I've had a two-way
 * conversation with, each with { canRequest, reason, prompt }.
 * Without a conversationId only people I can ask right now are returned.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const conversationId = new URL(req.url).searchParams.get('conversationId')
    if (conversationId && !isValidId(conversationId)) return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
    const people = await eligiblePeople(me, conversationId ? { conversationId } : {})
    return NextResponse.json({ people: conversationId ? people : people.filter((p) => p.canRequest) })
  } catch (error) {
    console.error('GET /api/reviews/eligible error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
