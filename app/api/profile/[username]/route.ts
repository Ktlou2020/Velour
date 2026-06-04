import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params

    const user = await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        createdAt: true,
        isVerified: true,
        profile: true,
        photos: {
          where: { isPrivate: false },
          orderBy: { order: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Track profile view (don't count self-views)
    if (user.id !== session.user.id) {
      await db.profile.update({
        where: { userId: user.id },
        data: { profileViews: { increment: 1 } },
      })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('GET /api/profile/[username] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
