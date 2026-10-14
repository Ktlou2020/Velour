import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getCallerContext, getSpotlight } from '../search'

/**
 * GET /api/members/spotlight?limit=3&discover=1
 * Rotating Platinum spotlight profiles for the caller (see getSpotlight).
 * discover=1 leaves out members the caller has already swiped on.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const caller = await getCallerContext(session.user.id, (session.user as { role?: string }).role)
    const members = await getSpotlight(caller, {
      limit: parseInt(searchParams.get('limit') ?? '3', 10) || 3,
      excludeActed: searchParams.get('discover') === '1',
    })
    return NextResponse.json({ members })
  } catch (error) {
    console.error('GET /api/members/spotlight error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
