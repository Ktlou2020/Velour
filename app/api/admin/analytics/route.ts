import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { getAdminAnalytics, getDailySeries, parseRange, seriesToCsv } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

/** GET /api/admin/analytics?days=30[&format=csv] */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const days = parseRange(searchParams.get('days'))
    if (searchParams.get('format') === 'csv') {
      const csv = seriesToCsv(await getDailySeries(days))
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hush-analytics-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json(await getAdminAnalytics(days), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
