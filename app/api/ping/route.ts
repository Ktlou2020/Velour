import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.profile.updateMany({
      where: { userId: session.user.id },
      data: {
        isOnline: true,
        lastSeen: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/ping error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
