import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getExplorePage, getTopThisWeek, loadViewer, parseFilters } from '@/lib/explore'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'

/**
 * GET /api/gallery — the Explore feed (logged-in members only).
 *
 *   sort        trending (default) | week | all | new
 *   who         everyone (default) | women | men | nonbinary | couples
 *   coupleType  MF | FF | MM | MX            (with who=couples)
 *   near=1      within 50 km of me (my travel location while travelling)
 *   verified=1  verified members only
 *   cursor      opaque, from the previous page's nextCursor
 *   top=1       also return the "Top photos this week" strip (first page)
 *
 * → { photos, nextCursor, needsLocation, viewer: { username, hasLocation }, top?, topPeriod? }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(`explore:${session.user.id}`, 240, 5 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const viewer = await loadViewer(session.user.id)
    if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const { sort, filters } = parseFilters(sp)
    const cursor = sp.get('cursor')
    const wantTop = sp.get('top') === '1' && !cursor

    const [page, top] = await Promise.all([
      getExplorePage(viewer, sort, filters, cursor),
      wantTop ? getTopThisWeek(viewer) : Promise.resolve(null),
    ])

    return NextResponse.json(
      {
        ...page,
        viewer: { username: viewer.username, hasLocation: !!viewer.location },
        ...(top ? { top: top.photos, topPeriod: top.period } : {}),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('GET /api/gallery error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
