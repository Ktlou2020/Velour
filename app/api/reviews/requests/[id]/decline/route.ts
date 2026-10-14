import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'

/**
 * POST /api/reviews/requests/[id]/decline — the reviewer says "Not now".
 * The requester is never told: their request reads "waiting" until it expires.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const me = session?.user?.id
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const r = await db.reviewRequest.updateMany({ where: { id, reviewerId: me, status: 'PENDING' }, data: { status: 'DECLINED' } })
    if (r.count === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    await db.notification.updateMany({
      where: { userId: me, type: 'REVIEW_REQUEST', data: { path: ['requestId'], equals: id } },
      data: { isRead: true },
    }).catch(() => {})
    return NextResponse.json({ declined: true })
  } catch (error) {
    console.error('POST /api/reviews/requests/[id]/decline error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
