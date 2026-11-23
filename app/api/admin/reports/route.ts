import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'
import { reportStats } from '@/lib/report-stats'

/** GET → response-time stats. PATCH { reportId } → resolve a report (any admin). */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await reportStats())
}

export async function PATCH(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { reportId } = await req.json().catch(() => ({})) as { reportId?: unknown }
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
