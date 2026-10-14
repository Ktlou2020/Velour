import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { sanitizeText } from '@/lib/review-text'
import { recomputeRating } from '@/lib/reviews'

export const dynamic = 'force-dynamic'

const reviewAdminSelect = {
  id: true, comment: true, response: true, isExplicit: true, isHidden: true, hiddenReason: true, reportCount: true,
  publishedAt: true, createdAt: true,
  respectful: true, communication: true, authenticity: true, reliability: true, overall: true,
  reviewer: { select: { id: true, username: true } },
  reviewee: { select: { id: true, username: true } },
} as const

/** GET /api/admin/reviews?filter=reported|hidden|recent&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sp = new URL(req.url).searchParams
    const filter = sp.get('filter') ?? 'reported'
    const page = Math.min(1000, Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1))
    const limit = 30
    const where = filter === 'hidden' ? { isHidden: true }
      : filter === 'recent' ? {}
      : { reportCount: { gt: 0 } }
    const orderBy = filter === 'reported'
      ? [{ isHidden: 'asc' as const }, { reportCount: 'desc' as const }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }]
    const [total, rows] = await Promise.all([
      db.review.count({ where }),
      db.review.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, select: reviewAdminSelect }),
    ])
    // Report reasons (from the admin REPORT notifications)
    const ids = rows.map((r) => r.id)
    const reports = ids.length
      ? await db.notification.findMany({
          where: { type: 'REPORT', OR: ids.map((id) => ({ data: { path: ['reviewId'], equals: id } })) },
          select: { data: true, createdAt: true, isRead: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })
      : []
    const reasons = new Map<string, { reason: string; details: string | null; at: string; open: boolean }[]>()
    for (const n of reports) {
      const d = n.data as { reviewId?: string; reason?: string; details?: string | null } | null
      if (!d?.reviewId) continue
      if (!reasons.has(d.reviewId)) reasons.set(d.reviewId, [])
      reasons.get(d.reviewId)!.push({ reason: d.reason ?? '', details: d.details ?? null, at: n.createdAt.toISOString(), open: !n.isRead })
    }
    return NextResponse.json({
      reviews: rows.map((r) => ({ ...r, reports: reasons.get(r.id) ?? [] })),
      total, page, pages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    console.error('GET /api/admin/reviews error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH /api/admin/reviews — { reviewId, action: 'hide' | 'unhide' | 'dismiss', reason? } */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json().catch(() => null) as { reviewId?: unknown; action?: unknown; reason?: unknown } | null
    if (!body || !isValidId(body.reviewId)) return NextResponse.json({ error: 'reviewId is required' }, { status: 400 })
    const action = body.action
    if (action !== 'hide' && action !== 'unhide' && action !== 'dismiss') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    const review = await db.review.findUnique({ where: { id: body.reviewId }, select: { id: true, revieweeId: true } })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    if (action === 'hide') {
      const reason = sanitizeText(body.reason, 200).slice(0, 200)
      if (!reason) return NextResponse.json({ error: 'Please give a reason for hiding' }, { status: 400 })
      await db.review.update({ where: { id: review.id }, data: { isHidden: true, hiddenReason: reason } })
    } else if (action === 'unhide') {
      await db.review.update({ where: { id: review.id }, data: { isHidden: false, hiddenReason: null } })
    } else {
      await db.review.update({ where: { id: review.id }, data: { reportCount: 0 } })
    }
    // Any action resolves the open reports for this review.
    await db.notification.updateMany({
      where: { type: 'REPORT', isRead: false, data: { path: ['reviewId'], equals: review.id } },
      data: { isRead: true },
    })
    const rating = await recomputeRating(review.revieweeId)
    console.info(`admin ${admin.id} ${action} review ${review.id}`)
    return NextResponse.json({ ok: true, rating })
  } catch (error) {
    console.error('PATCH /api/admin/reviews error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
