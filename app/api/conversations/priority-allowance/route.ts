import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getPriorityAllowance } from '@/lib/chat-priority'
import { isValidId } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/conversations/priority-allowance[?conversationId=]
 * → { plan, limit, used, remaining, resetsAt, usedInConversationToday? }
 * limit/remaining are null for unlimited (Platinum); limit 0 = locked (Free).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const raw = req.nextUrl.searchParams.get('conversationId')
    const conversationId = raw && isValidId(raw) ? raw : null
    return NextResponse.json(await getPriorityAllowance(session.user.id, conversationId))
  } catch (error) {
    console.error('GET /api/conversations/priority-allowance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
