import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = 48
    const skip = (page - 1) * limit

    const photos = await db.photo.findMany({
      where: {
        isPrivate: false,
        user: { isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        url: true,
        thumbnailUrl: true,
        caption: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            profile: {
              select: {
                displayName: true,
                profilePhoto: true,
              },
            },
          },
        },
      },
    })

    const total = await db.photo.count({
      where: { isPrivate: false, user: { isActive: true } },
    })

    return NextResponse.json({
      photos,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('GET /api/gallery error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
