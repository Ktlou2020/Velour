import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'
import { REMOVE_REASONS, approvePhoto, removePhoto, reviewQueueWhere } from '@/lib/photo-review'

/** GET → photos waiting for review (oldest first). */
export async function GET() {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const where = reviewQueueWhere()
  const [photos, total] = await Promise.all([
    db.photo.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 60,
      select: {
        id: true, url: true, isProfile: true, createdAt: true,
        user: { select: { id: true, username: true, isVerified: true, profile: { select: { displayName: true } } } },
      },
    }),
    db.photo.count({ where }),
  ])
  return NextResponse.json({ photos, total, reasons: REMOVE_REASONS })
}

/** POST { photoIds: string[], action: 'approve' } or { photoId, action: 'remove', reason } */
export async function POST(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { photoId?: unknown; photoIds?: unknown; action?: unknown; reason?: unknown }

  if (body.action === 'approve') {
    const ids = (Array.isArray(body.photoIds) ? body.photoIds : [body.photoId]).filter(isValidId).slice(0, 100)
    if (!ids.length) return NextResponse.json({ error: 'No photos' }, { status: 400 })
    let n = 0
    for (const id of ids) if (await approvePhoto(id, me.id)) n++
    if (n) await audit(me.id, 'PHOTOS_APPROVED', null, { count: n })
    return NextResponse.json({ approved: n })
  }

  if (body.action === 'remove') {
    const reason = typeof body.reason === 'string' && (REMOVE_REASONS as readonly string[]).includes(body.reason) ? body.reason : null
    if (!isValidId(body.photoId) || !reason) return NextResponse.json({ error: 'Choose a reason' }, { status: 400 })
    const owner = await removePhoto(body.photoId, reason)
    if (!owner) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    await audit(me.id, 'PHOTO_REMOVED', owner, { photoId: body.photoId, reason })
    return NextResponse.json({ removed: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
