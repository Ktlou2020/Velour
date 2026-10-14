import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { entitlements } from '@/lib/plans'

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

    // membershipTier isn't in the JWT session — tell the client whether the
    // viewer may reply so free members see an upgrade prompt, not a failing box.
    const viewer = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, profile: { select: { membershipTier: true } } },
    })
    const viewerCanPost = entitlements(viewer?.profile?.membershipTier, viewer?.role).forumPosting

    return NextResponse.json({ thread, viewerCanPost })
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

    // Forum posting is open to every plan (lib/plans.ts → forumPosting)
    const poster = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, profile: { select: { membershipTier: true } } },
    })

    if (!entitlements(poster?.profile?.membershipTier, poster?.role).forumPosting) {
      return NextResponse.json(
        { error: 'Your plan does not include forum replies', upgrade: true },
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
