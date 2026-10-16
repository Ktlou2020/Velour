import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

/** Lifecycle email preference ("Emails about likes, messages and tips"). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const u = await db.user.findUnique({ where: { id: session.user.id }, select: { emailMarketingOptOut: true } })
    if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ marketingEmails: !u.emailMarketingOptOut })
  } catch (error) {
    console.error('GET /api/account/email-preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { marketingEmails } = (await req.json().catch(() => ({}))) as { marketingEmails?: unknown }
    if (typeof marketingEmails !== 'boolean') {
      return NextResponse.json({ error: 'marketingEmails must be true or false' }, { status: 400 })
    }
    const u = await db.user.update({
      where: { id: session.user.id },
      data: { emailMarketingOptOut: !marketingEmails },
      select: { emailMarketingOptOut: true },
    })
    return NextResponse.json({ marketingEmails: !u.emailMarketingOptOut })
  } catch (error) {
    console.error('PATCH /api/account/email-preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
