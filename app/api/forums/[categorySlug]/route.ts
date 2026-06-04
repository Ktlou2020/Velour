import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ categorySlug: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { categorySlug } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    const skip = (page - 1) * limit

    const category = await db.forumCategory.findUnique({
      where: { slug: categorySlug },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const [threads, total] = await Promise.all([
      db.forumThread.findMany({
        where: { categoryId: category.id },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              profile: { select: { displayName: true, profilePhoto: true } },
            },
          },
          _count: { select: { posts: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.forumThread.count({ where: { categoryId: category.id } }),
    ])

    return NextResponse.json({
      category,
      threads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('GET /api/forums/[categorySlug] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ categorySlug: string }> }
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
        { error: 'Upgrade to Gold or Platinum to post in forums' },
        { status: 403 }
      )
    }

    const { categorySlug } = await params
    const body = await req.json()
    const { title, content } = body as { title?: string; content?: string }

    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    const category = await db.forumCategory.findUnique({
      where: { slug: categorySlug },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const thread = await db.forumThread.create({
      data: {
        categoryId: category.id,
        authorId: session.user.id,
        title,
        posts: {
          create: {
            authorId: session.user.id,
            content,
          },
        },
      },
      include: {
        posts: true,
        author: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, profilePhoto: true } },
          },
        },
      },
    })

    return NextResponse.json({ thread }, { status: 201 })
  } catch (error) {
    console.error('POST /api/forums/[categorySlug] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
