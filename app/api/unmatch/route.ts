import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { unmatch } from '@/lib/unmatch'

/**
 * POST { userId } or { username } → unmatch: ends the match and the chat for
 * both, and neither can message the other again (lib/unmatch.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({})) as { userId?: unknown; username?: unknown }
    const target = isValidId(body.userId)
      ? await db.user.findUnique({ where: { id: body.userId }, select: { id: true } })
      : typeof body.username === 'string' && body.username.length <= 64
        ? await db.user.findUnique({ where: { username: body.username }, select: { id: true } })
        : null
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (target.id === session.user.id) return NextResponse.json({ error: 'You can’t unmatch yourself' }, { status: 400 })
    await unmatch(session.user.id, target.id)
    return NextResponse.json({ unmatched: true })
  } catch (error) {
    console.error('POST /api/unmatch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
