import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getCoupleMemberNames, setTypingAs } from '@/lib/couples'

const TYPING_TTL_MS = 5000

/**
 * POST { isTyping?: boolean, as?: string } — marks the caller as typing for
 * the next 5s (or clears it when isTyping is false). Clients throttle to
 * ~1 call / 2s. `as` is the partner's name on a shared couple account.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id: conversationId } = await params
    const body = await req.json().catch(() => ({})) as { isTyping?: boolean; as?: unknown }
    const typing = body.isTyping !== false

    const res = await db.conversationParticipant.updateMany({
      where: { conversationId, userId: session.user.id },
      data: { typingUntil: typing ? new Date(Date.now() + TYPING_TTL_MS) : null },
    })
    if (res.count === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    let as: string | null = null
    if (typing && typeof body.as === 'string' && body.as.trim()) {
      const p = await db.profile.findUnique({
        where: { userId: session.user.id },
        select: { isCouple: true, partnerId: true, coupleMembers: true },
      })
      const names = p?.isCouple && !p.partnerId ? getCoupleMemberNames(p.coupleMembers) : []
      if (names.includes(body.as.trim())) as = body.as.trim()
    }
    setTypingAs(conversationId, session.user.id, as, TYPING_TTL_MS)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/conversations/[id]/typing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
