import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: threadId } = await params

    const thread = await db.forumThread.findUnique({
      where: { id: threadId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, profilePhoto: true } },
          },
        },
        category: true,
        posts: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                profile: { select: { displayName: true, profilePhoto: true } },
              },
            },
          },
        },
      },
    })

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Increment view count
    await db.forumThread.update({
      where: { id: threadId },
      data: { views: { increment: 1 } },
    })

    return NextResponse.json({ thread })
  } catch (error) {
    console.error('GET /api/forums/threads/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // GOLD/PLATINUM only
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { membershipTier: true },
    })

    if (!profile || profile.membershipTier === 'FREE') {
      return NextResponse.json(
        { error: 'Upgrade to Gold or Platinum to reply in forums' },
        { status: 403 }
      )
    }

    const { id: threadId } = await params
    const body = await req.json()
    const { content } = body as { content?: string }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const thread = await db.forumThread.findUnique({ where: { id: threadId } })
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    if (thread.isLocked) {
      return NextResponse.json({ error: 'Thread is locked' }, { status: 403 })
    }

    const post = await db.forumPost.create({
      data: {
        threadId,
        authorId: session.user.id,
        content: content.trim(),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, profilePhoto: true } },
          },
        },
      },
    })

    // Update thread updatedAt
    await db.forumThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('POST /api/forums/threads/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
