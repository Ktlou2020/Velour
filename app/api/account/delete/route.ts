import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { confirmation } = await req.json() as { confirmation?: string }
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return NextResponse.json({ error: 'Type DELETE MY ACCOUNT to confirm' }, { status: 400 })
    }

    // Cascade delete — Prisma onDelete: Cascade handles most relations.
    // Push subscriptions, notifications, likes, matches, photos, messages all cascade.
    await db.user.delete({ where: { id: session.user.id } })

    return NextResponse.json({ ok: true, message: 'Account permanently deleted' })
  } catch (error) {
    console.error('POST /api/account/delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
