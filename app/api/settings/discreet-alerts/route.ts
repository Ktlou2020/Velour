import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

/** GET → { discreet }   POST { discreet: boolean } → { discreet } */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = await db.profile.findUnique({ where: { userId: session.user.id }, select: { discreetAlerts: true } })
  return NextResponse.json({ discreet: !!p?.discreetAlerts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { discreet } = await req.json().catch(() => ({})) as { discreet?: unknown }
  if (typeof discreet !== 'boolean') return NextResponse.json({ error: 'discreet must be true or false' }, { status: 400 })
  await db.profile.upsert({
    where: { userId: session.user.id },
    update: { discreetAlerts: discreet },
    create: { userId: session.user.id, discreetAlerts: discreet },
  })
  return NextResponse.json({ discreet })
}
