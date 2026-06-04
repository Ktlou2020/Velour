import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { loginStreak: true, lastLoginDate: true, superLikeCredits: true },
    })

    return NextResponse.json({
      streak: user?.loginStreak ?? 0,
      superLikeCredits: user?.superLikeCredits ?? 1,
      lastLoginDate: user?.lastLoginDate ?? null,
    })
  } catch (error) {
    console.error('GET /api/streak error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
