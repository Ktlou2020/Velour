import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isMessagePolicy } from '@/lib/message-policy'

/** GET → { policy }   POST { policy: EVERYONE | VERIFIED | LIKED } → { policy } */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = await db.profile.findUnique({ where: { userId: session.user.id }, select: { messagePolicy: true } })
  return NextResponse.json({ policy: p?.messagePolicy ?? 'EVERYONE' })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { policy?: unknown }
  if (!isMessagePolicy(body.policy)) return NextResponse.json({ error: 'Choose who can message you' }, { status: 400 })
  await db.profile.upsert({
    where: { userId: session.user.id },
    update: { messagePolicy: body.policy },
    create: { userId: session.user.id, messagePolicy: body.policy },
  })
  return NextResponse.json({ policy: body.policy })
}
