import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const DURATIONS: Record<string, number | null> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  indefinite: null,
}

function effective(p: { isSnoozed: boolean; snoozedUntil: Date | null } | null) {
  const active = !!p?.isSnoozed && (!p.snoozedUntil || p.snoozedUntil.getTime() > Date.now())
  return { isSnoozed: active, snoozedUntil: active ? p?.snoozedUntil ?? null : null }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { isSnoozed: true, snoozedUntil: true },
    })
    return NextResponse.json(effective(profile))
  } catch (error) {
    console.error('GET /api/account/snooze error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { duration } = await req.json().catch(() => ({})) as { duration?: string }
    if (!duration || !(duration in DURATIONS)) {
      return NextResponse.json({ error: 'duration must be one of 24h, 3d, 1w, indefinite' }, { status: 400 })
    }
    const ms = DURATIONS[duration]
    const snoozedUntil = ms === null ? null : new Date(Date.now() + ms)
    const profile = await db.profile.update({
      where: { userId: session.user.id },
      data: { isSnoozed: true, snoozedUntil },
      select: { isSnoozed: true, snoozedUntil: true },
    })
    return NextResponse.json(effective(profile))
  } catch (error) {
    console.error('POST /api/account/snooze error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await db.profile.update({
      where: { userId: session.user.id },
      data: { isSnoozed: false, snoozedUntil: null },
    })
    return NextResponse.json({ isSnoozed: false, snoozedUntil: null })
  } catch (error) {
    console.error('DELETE /api/account/snooze error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
