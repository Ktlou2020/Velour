import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const matches = await db.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                profilePhoto: true,
                city: true,
                country: true,
                gender: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                profilePhoto: true,
                city: true,
                country: true,
                gender: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Return matches with the "other" user surfaced
    const formattedMatches = matches.map((match) => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1
      return {
        id: match.id,
        createdAt: match.createdAt,
        otherUser,
      }
    })

    return NextResponse.json({ matches: formattedMatches })
  } catch (error) {
    console.error('GET /api/matches error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
