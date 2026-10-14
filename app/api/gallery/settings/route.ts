import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { GALLERY_PHOTO_WHERE } from '@/lib/media'
import { thumbFor } from '@/lib/explore'

async function stats(userId: string) {
  const [agg, top] = await Promise.all([
    db.photo.aggregate({ where: { userId, ...GALLERY_PHOTO_WHERE }, _sum: { likeCount: true } }),
    db.photo.findFirst({
      where: { userId, likeCount: { gt: 0 }, ...GALLERY_PHOTO_WHERE },
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, url: true, thumbnailUrl: true, likeCount: true, isPrivate: true },
    }),
  ])
  return {
    totalLikes: Math.max(0, agg._sum.likeCount ?? 0),
    mostLiked: top ? { id: top.id, thumbUrl: thumbFor(top.url, top.thumbnailUrl), likeCount: top.likeCount, isPrivate: top.isPrivate } : null,
  }
}

/** GET /api/gallery/settings → { showInExplore, totalLikes, mostLiked } */
export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const profile = await db.profile.findUnique({ where: { userId }, select: { showInExplore: true } })
    return NextResponse.json({ showInExplore: profile?.showInExplore ?? true, ...(await stats(userId)) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('GET /api/gallery/settings error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH /api/gallery/settings { showInExplore: boolean } */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => null) as { showInExplore?: unknown } | null
    if (typeof body?.showInExplore !== 'boolean') {
      return NextResponse.json({ error: 'showInExplore must be true or false' }, { status: 400 })
    }
    const res = await db.profile.updateMany({ where: { userId }, data: { showInExplore: body.showInExplore } })
    if (res.count === 0) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })
    return NextResponse.json({ showInExplore: body.showInExplore })
  } catch (error) {
    console.error('PATCH /api/gallery/settings error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
