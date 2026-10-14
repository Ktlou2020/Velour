import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { CITIES_BY_COUNTRY } from '@/lib/cities'
import { entitlements } from '@/lib/plans'
import { isTravelling } from '@/lib/premium'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DAYS = 30
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000

/**
 * Travel mode (Gold+): browse and appear in another city until a date.
 *   GET    → { entitled, active, city, country, until, maxDays }
 *   POST   { city, country, until: "YYYY-MM-DD" | ISO } → sets the destination
 *   DELETE → ends travel mode
 * lib/cities.ts has no coordinates, so travel works on the city name and
 * travelLat/travelLng stay null (distance search is unavailable while away).
 */
async function load(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      profile: { select: { membershipTier: true, city: true, travelCity: true, travelCountry: true, travelUntil: true } },
    },
  })
  const p = u?.profile
  const entitled = entitlements(p?.membershipTier, u?.role).travelMode
  const active = entitled && isTravelling(p)
  return {
    hasProfile: !!p,
    body: {
      entitled,
      active,
      city: active ? p!.travelCity : null,
      country: active ? (p!.travelCountry ?? null) : null,
      until: active ? p!.travelUntil : null,
      homeCity: p?.city ?? null,
      maxDays: MAX_DAYS,
    },
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json((await load(session.user.id)).body)
  } catch (error) {
    console.error('GET /api/travel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** End of the given calendar day in SAST (23:59:59.999), as a UTC Date. */
function endOfDaySAST(d: Date): Date {
  const local = new Date(d.getTime() + SAST_OFFSET_MS)
  local.setUTCHours(23, 59, 59, 999)
  return new Date(local.getTime() - SAST_OFFSET_MS)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const state = await load(session.user.id)
    if (!state.body.entitled) {
      return NextResponse.json({ error: 'Travel mode is part of Gold and Platinum.', upgrade: true }, { status: 403 })
    }
    if (!state.hasProfile) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

    const body = await req.json().catch(() => null) as { city?: unknown; country?: unknown; until?: unknown } | null
    const country = typeof body?.country === 'string' ? body.country.trim() : ''
    const city = typeof body?.city === 'string' ? body.city.trim() : ''
    const cities = CITIES_BY_COUNTRY[country]
    if (!cities || !cities.length) return NextResponse.json({ error: 'Choose a country' }, { status: 400 })
    const match = cities.find((c) => c.toLowerCase() === city.toLowerCase())
    if (!match) return NextResponse.json({ error: 'Choose a city from the list' }, { status: 400 })

    const raw = typeof body?.until === 'string' ? body.until.trim() : ''
    // "YYYY-MM-DD" is read as a SAST calendar date; anything else as an ISO timestamp.
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00+02:00`) : new Date(raw)
    if (!raw || Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Choose an end date' }, { status: 400 })
    const now = Date.now()
    const until = endOfDaySAST(parsed)
    if (until.getTime() <= now) return NextResponse.json({ error: 'The end date must be in the future' }, { status: 400 })
    if (until.getTime() > endOfDaySAST(new Date(now + MAX_DAYS * DAY_MS)).getTime()) {
      return NextResponse.json({ error: `Travel mode can be set for up to ${MAX_DAYS} days` }, { status: 400 })
    }

    await db.profile.update({
      where: { userId: session.user.id },
      data: { travelCity: match, travelCountry: country, travelLat: null, travelLng: null, travelUntil: until },
    })
    return NextResponse.json((await load(session.user.id)).body)
  } catch (error) {
    console.error('POST /api/travel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await db.profile.updateMany({
      where: { userId: session.user.id },
      data: { travelCity: null, travelCountry: null, travelLat: null, travelLng: null, travelUntil: null },
    })
    return NextResponse.json((await load(session.user.id)).body)
  } catch (error) {
    console.error('DELETE /api/travel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
