import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { userId: blockedId } = body as { userId?: string }

    if (!blockedId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (blockedId === session.user.id) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 })
    }

    const blockerId = session.user.id

    // Upsert block
    await db.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    })

    // Delete likes between the two users
    await db.like.deleteMany({
      where: {
        OR: [
          { fromUserId: blockerId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: blockerId },
        ],
      },
    })

    // Delete matches between the two users
    await db.match.deleteMany({
      where: {
        OR: [
          { user1Id: blockerId, user2Id: blockedId },
          { user1Id: blockedId, user2Id: blockerId },
        ],
      },
    })

    return NextResponse.json({ blocked: true })
  } catch (error) {
    console.error('POST /api/block error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { userId: blockedId } = body as { userId?: string }

    if (!blockedId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const blockerId = session.user.id

    await db.block.deleteMany({
      where: { blockerId, blockedId },
    })

    return NextResponse.json({ unblocked: true })
  } catch (error) {
    console.error('DELETE /api/block error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const blocks = await db.block.findMany({
      where: { blockerId: session.user.id },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                profilePhoto: true,
                city: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const blockedUsers = blocks.map((b) => ({
      id: b.blocked.id,
      username: b.blocked.username,
      profile: b.blocked.profile,
      blockedAt: b.createdAt,
    }))

    return NextResponse.json({ blockedUsers })
  } catch (error) {
    console.error('GET /api/block error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
