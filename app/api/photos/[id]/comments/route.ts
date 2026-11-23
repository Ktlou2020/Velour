import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isValidId } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { PROFILE_NOT_READY_ERROR, userProfileReady } from '@/lib/profile-ready'
import { addComment, commentProblem, findCommentablePhoto, listComments } from '@/lib/photo-comments'
import { UNDER_REVIEW_ERROR, commentVelocityProblem, isUnderReview } from '@/lib/auto-protect'

/**
 * GET  /api/photos/<id>/comments?before=<iso>  → { comments, hasMore, before, count }
 * POST /api/photos/<id>/comments { body }       → { comment }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const photo = await findCommentablePhoto(userId, id)
  if (!photo) return NextResponse.json({ error: 'This photo is no longer available' }, { status: 404 })
  const raw = req.nextUrl.searchParams.get('before')
  const before = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : undefined
  const isAdmin = (session.user as { role?: string }).role === 'ADMIN'
  return NextResponse.json(await listComments({ viewerId: userId, isAdmin, photo, before }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!rateLimit(`photo-comment:${userId}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'You’re commenting very quickly — take a short break and try again.' }, { status: 429 })
    }
    if (!(await userProfileReady(userId))) {
      return NextResponse.json({ error: PROFILE_NOT_READY_ERROR.replace('messaging', 'commenting'), code: 'PROFILE_INCOMPLETE' }, { status: 403 })
    }
    if (await isUnderReview(userId)) return NextResponse.json({ error: UNDER_REVIEW_ERROR, code: 'UNDER_REVIEW' }, { status: 403 })
    const slow = await commentVelocityProblem(userId)
    if (slow) return NextResponse.json({ error: slow, code: 'SLOW_DOWN' }, { status: 429 })
    const { body } = await req.json().catch(() => ({})) as { body?: unknown }
    const problem = commentProblem(body)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })
    const photo = await findCommentablePhoto(userId, id)
    if (!photo) return NextResponse.json({ error: 'This photo is no longer available' }, { status: 404 })
    const c = await addComment(photo, userId, body as string)
    return NextResponse.json({ comment: { id: c.id } }, { status: 201 })
  } catch (error) {
    console.error('POST /api/photos/[id]/comments error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
