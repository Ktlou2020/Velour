import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await db.forumCategory.findMany({
      include: {
        _count: { select: { threads: true } },
        threads: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            createdAt: true,
            author: {
              select: {
                username: true,
                profile: { select: { displayName: true, profilePhoto: true } },
              },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('GET /api/forums error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
