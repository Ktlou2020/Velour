import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendBrandedEmail } from '@/lib/email'
import { checkInEmail, planSelect } from '../shared'

type Ctx = { params: Promise<{ id: string }> }

async function ownPlan(id: string, userId: string) {
  const plan = await db.datePlan.findUnique({ where: { id }, select: { ...planSelect, userId: true } })
  return plan && plan.userId === userId ? plan : null
}

/** PATCH — "I'm safe" check-in; emails the friend once. */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const plan = await ownPlan(id, userId)
    if (!plan) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Conditional update so a double-click can't send two emails.
    const claimed = await db.datePlan.updateMany({
      where: { id, userId, checkedInAt: null },
      data: { checkedInAt: new Date() },
    })
    const updated = await db.datePlan.findUnique({ where: { id }, select: planSelect })
    if (claimed.count === 0) {
      return NextResponse.json({ plan: updated, emailed: false })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true, profile: { select: { displayName: true } } },
    })
    const senderName = user?.profile?.displayName || user?.username || 'Your friend'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    let emailed = true
    try {
      await sendBrandedEmail(
        plan.friendEmail,
        `${senderName} checked in safely`.slice(0, 150),
        'Checked In Safely',
        checkInEmail(senderName, plan.friendName, appUrl)
      )
    } catch (err) {
      emailed = false
      console.error('[safety/date-plans] check-in email failed:', err)
    }

    return NextResponse.json({ plan: updated, emailed })
  } catch (error) {
    console.error('PATCH /api/safety/date-plans/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE — remove a plan. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await db.datePlan.deleteMany({ where: { id, userId } })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/safety/date-plans/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
