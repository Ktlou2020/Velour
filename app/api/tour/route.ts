import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

// Only members whose account is this new get the tour automatically, so
// existing members aren't ambushed when it ships. Anyone can replay it.
const AUTO_SHOW_WINDOW_DAYS = 7

/**
 * GET /api/tour — whether the first-run tour should auto-show.
 * `completed`: the member has finished or skipped it (on any device).
 * `autoShow`: not completed, onboarding done, and account < 7 days old.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        createdAt: true,
        profile: { select: { tourCompletedAt: true, displayName: true, dateOfBirth: true } },
      },
    })
    if (!user) return NextResponse.json({ completed: false, autoShow: false })
    const completed = !!user.profile?.tourCompletedAt
    const recent = Date.now() - user.createdAt.getTime() < AUTO_SHOW_WINDOW_DAYS * 24 * 60 * 60 * 1000
    // Onboarding saves the display name and date of birth in its first steps.
    const onboarded = !!user.profile?.displayName && !!user.profile?.dateOfBirth
    return NextResponse.json(
      { completed, autoShow: !completed && recent && onboarded },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    // e.g. the column isn't migrated yet: never block the page over a tour.
    console.error('GET /api/tour error:', error)
    return NextResponse.json({ completed: false, autoShow: false })
  }
}

/** POST /api/tour — mark the tour finished/skipped for this member. */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await db.profile.updateMany({
      where: { userId: session.user.id, tourCompletedAt: null },
      data: { tourCompletedAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/tour error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
