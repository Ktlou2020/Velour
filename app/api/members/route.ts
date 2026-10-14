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
      show: searchParams.get('show'),
      coupleType: searchParams.get('coupleType'),
      anyCity: searchParams.get('anyCity'),
      radius: searchParams.get('radius'),
      heightMin: searchParams.get('heightMin'),
      heightMax: searchParams.get('heightMax'),
      bodyType: searchParams.get('bodyType'),
      intentions: searchParams.get('intentions'),
      languages: searchParams.get('languages'),
      verified: searchParams.get('verified'),
      photos: searchParams.get('photos'),
      active: searchParams.get('active'),
    })

    return NextResponse.json({
      members: result.members,
      callerHasLocation: result.callerHasLocation,
      effectiveCity: result.effectiveCity,
      radiusKm: result.radiusKm,
      sort: result.sort,
      unknownDistance: result.unknownDistance,
      // Sections, in list order: inRadius → unknownDistance → furtherAway (members flagged beyondRadius)
      sections: { inRadius: result.inRadius, unknownDistance: result.unknownDistance, furtherAway: result.furtherAway },
      furtherAwayMaxKm: result.furtherAwayMaxKm,
      travel: caller.travel ? { city: caller.travel.city, until: caller.travel.until } : null,
      // Advanced filters need Gold+; for other plans they're ignored, not errors.
      ...(result.ignoredFilters.length ? { ignoredFilters: result.ignoredFilters, upgrade: true } : {}),
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
