import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { mediaIdFromUrl, mediaThumbUrl } from '@/lib/media'

const PAGE = 30

/**
 * GET /api/photos/<id>/likes?cursor= — who liked my photo (owner only).
 * Members blocked in either direction and deactivated accounts are left out.
 * → { likers: [{ username, name, avatarUrl, isVerified, likedAt }], total, nextCursor }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const photo = await db.photo.findUnique({ where: { id }, select: { userId: true } })
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (photo.userId !== userId) return NextResponse.json({ error: 'Only the owner can see who liked this photo' }, { status: 403 })

    const cursor = req.nextUrl.searchParams.get('cursor')
    const where = {
      photoId: id,
      user: {
        isActive: true,
        blocksGiven: { none: { blockedId: userId } },
        blocksReceived: { none: { blockerId: userId } },
      },
    }
    const [rows, total] = await Promise.all([
      db.photoLike.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
        ...(cursor && isValidId(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          createdAt: true,
          user: { select: { username: true, isVerified: true, profile: { select: { displayName: true, profilePhoto: true } } } },
        },
      }),
      db.photoLike.count({ where }),
    ])
    const page = rows.slice(0, PAGE)
    return NextResponse.json({
      likers: page.map((r) => {
        const avatar = r.user.profile?.profilePhoto || null
        const mid = avatar ? mediaIdFromUrl(avatar) : null
        return {
          username: r.user.username,
          name: r.user.profile?.displayName || r.user.username,
          avatarUrl: mid ? mediaThumbUrl(mid) : avatar,
          isVerified: r.user.isVerified,
          likedAt: r.createdAt.toISOString(),
        }
      }),
      total,
      nextCursor: rows.length > PAGE ? page[page.length - 1].id : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('GET /api/photos/[id]/likes error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
