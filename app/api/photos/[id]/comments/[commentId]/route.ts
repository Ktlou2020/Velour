import { NextResponse } from 'next/server'
import { auth, requireAdmin } from '@/auth'
import { isValidId } from '@/lib/security'
import { audit } from '@/lib/admin-team'
import { deleteComment } from '@/lib/photo-comments'
import { db } from '@/lib/db'

/** DELETE → removes a comment (its author, the photo's owner, or an admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, commentId } = await params
  if (!isValidId(id) || !isValidId(commentId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const c = await db.photoComment.findFirst({ where: { id: commentId, photoId: id }, select: { userId: true, body: true, photo: { select: { userId: true } } } })
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const asAdmin = c.userId !== userId && c.photo.userId !== userId ? await requireAdmin() : null
  const r = await deleteComment(commentId, { id: userId, isAdmin: !!asAdmin })
  if (r === 'missing') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (r === 'forbidden') return NextResponse.json({ error: 'You can’t delete this comment' }, { status: 403 })
  if (asAdmin) await audit(asAdmin.id, 'PHOTO_COMMENT_REMOVED', c.userId, { photoId: id, body: c.body.slice(0, 200) })
  return NextResponse.json({ ok: true })
}
