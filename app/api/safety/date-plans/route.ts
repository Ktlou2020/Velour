import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendBrandedEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { DAILY_LIMIT, datePlanEmail, planSelect, validateDatePlan } from './shared'

const DAY_MS = 24 * 60 * 60 * 1000

/** GET — the caller's upcoming (and last-24h) date plans. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await db.datePlan.findMany({
      where: { userId: session.user.id, dateTime: { gte: new Date(Date.now() - DAY_MS) } },
      select: planSelect,
      orderBy: { dateTime: 'asc' },
      take: 50,
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('GET /api/safety/date-plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST — create a plan and email the trusted friend. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const result = validateDatePlan(body)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const plan = result.data

    // Limit how many friend emails one account can trigger (persisted check +
    // in-memory burst guard).
    const recent = await db.datePlan.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    })
    if (recent >= DAILY_LIMIT || !rateLimit(`date-plan:${userId}`, DAILY_LIMIT, DAY_MS)) {
      return NextResponse.json(
        { error: `You can share up to ${DAILY_LIMIT} dates per day. Please try again later.` },
        { status: 429 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true, profile: { select: { displayName: true } } },
    })
    const senderName = user?.profile?.displayName || user?.username || 'Your friend'

    const created = await db.datePlan.create({
      data: { userId, ...plan },
      select: planSelect,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    let emailed = true
    try {
      await sendBrandedEmail(
        plan.friendEmail,
        `${senderName} shared their date plans with you`.slice(0, 150),
        'Share My Date',
        datePlanEmail(senderName, plan, appUrl)
      )
    } catch (err) {
      emailed = false
      console.error('[safety/date-plans] friend email failed:', err)
    }

    return NextResponse.json({ plan: created, emailed }, { status: 201 })
  } catch (error) {
    console.error('POST /api/safety/date-plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
