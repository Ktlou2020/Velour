import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getCallerContext, searchMembers } from './search'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const callerRole = (session.user as { role?: string }).role
    const caller = await getCallerContext(session.user.id, callerRole)

    const result = await searchMembers(caller, {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      gender: searchParams.get('gender'),
      ageMin: searchParams.get('ageMin') ?? searchParams.get('minAge'),
      ageMax: searchParams.get('ageMax') ?? searchParams.get('maxAge'),
      city: searchParams.get('city'),
      tier: searchParams.get('tier'),
      lookingFor: searchParams.get('lookingFor'),
      online: searchParams.get('online'),
      sort: searchParams.get('sort'),
      maxKm: searchParams.get('maxKm'),
      discover: searchParams.get('discover'),
    })

    return NextResponse.json({
      members: result.members,
      callerHasLocation: result.callerHasLocation,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
    })
  } catch (error) {
    console.error('GET /api/members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
