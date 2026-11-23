import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'
import { reportStats } from '@/lib/report-stats'
import { restoreFromReview } from '@/lib/auto-protect'

/**
 * GET → response-time stats.
 * PATCH { reportId } → resolve a report (any admin).
 * PATCH { action: 'restore', userId } → un-hide a member hidden pending review (resolves their open reports).
 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await reportStats())
}

export async function PATCH(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { reportId?: unknown; action?: unknown; userId?: unknown }
  if (body.action === 'restore') {
    if (!isValidId(body.userId)) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    const u = await db.user.findUnique({ where: { id: body.userId }, select: { underReviewAt: true } })
    if (!u) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    await restoreFromReview(body.userId)
    await audit(me.id, 'REVIEW_RESTORED', body.userId)
    return NextResponse.json({ ok: true })
  }
  const reportId = body.reportId
  if (!isValidId(reportId)) return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
  const report = await db.notification.findFirst({ where: { id: reportId, type: 'REPORT' }, select: { id: true, isRead: true, data: true } })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (!report.isRead) {
    await db.notification.update({ where: { id: report.id }, data: { isRead: true, readAt: new Date() } })
    const d = (report.data ?? {}) as { reportedUserId?: string; reason?: string }
    await audit(me.id, 'REPORT_RESOLVED', d.reportedUserId ?? null, { reportId: report.id, reason: d.reason })
  }
  return NextResponse.json({ ok: true })
}
