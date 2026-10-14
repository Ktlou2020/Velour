import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { findLikeablePhoto, notifyPhotoLike } from '@/lib/explore'

/**
 * POST /api/photos/<id>/like  { like?: boolean }
 *
 * Without a body it toggles; `{ like: true }` / `{ like: false }` set the
 * state idempotently (double-tap only ever likes). Only photos currently
 * eligible for Explore can be liked, and never your own.
 * → { liked, likeCount }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!rateLimit(`photo-like:${userId}`, 120, 10 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as { like?: unknown } | null
    const want = typeof body?.like === 'boolean' ? body.like : null

    const photo = await findLikeablePhoto(userId, id)
    if (!photo) return NextResponse.json({ error: 'This photo is no longer available' }, { status: 404 })
    if (photo.userId === userId) return NextResponse.json({ error: 'You can’t like your own photo' }, { status: 400 })

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.photoLike.findUnique({ where: { photoId_userId: { photoId: id, userId } }, select: { id: true } })
      const target = want ?? !existing
      let created = false
      if (target && !existing) {
        // ON CONFLICT DO NOTHING: a concurrent request may have liked it already.
        const ins = await tx.photoLike.createMany({ data: [{ photoId: id, userId }], skipDuplicates: true })
        if (ins.count > 0) {
          await tx.photo.update({ where: { id }, data: { likeCount: { increment: 1 } } })
          created = true
        }
      } else if (!target && existing) {
        const del = await tx.photoLike.deleteMany({ where: { id: existing.id } })
        if (del.count > 0) {
          // Never below zero.
          await tx.photo.updateMany({ where: { id, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } })
        }
      }
      const p = await tx.photo.findUnique({ where: { id }, select: { likeCount: true } })
      return { liked: target, likeCount: Math.max(0, p?.likeCount ?? 0), created }
    })

    if (result.created) {
      await notifyPhotoLike({ ownerId: photo.userId, photoId: id, caption: photo.caption, likerId: userId }).catch((e) =>
        console.error('photo like notification failed:', e instanceof Error ? e.message : e),
      )
    }

    return NextResponse.json({ liked: result.liked, likeCount: result.likeCount })
  } catch (error) {
    console.error('POST /api/photos/[id]/like error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
