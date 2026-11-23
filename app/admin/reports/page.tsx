import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { reportStats } from '@/lib/report-stats';
import AdminReportsClient from './AdminReportsClient';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  // Role is checked against the database, not just the session token.
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/members');
  }

  const [rows, stats] = await Promise.all([
    db.notification.findMany({
      where: { type: 'REPORT' },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'asc' }],
      take: 300,
      select: { id: true, isRead: true, readAt: true, data: true, createdAt: true },
    }),
    reportStats(),
  ]);

  // Reports are delivered to one admin's inbox; the people involved are in `data`.
  const ids = new Set<string>();
  for (const r of rows) {
    const d = (r.data ?? {}) as { reportedBy?: string; reportedUserId?: string };
    if (d.reportedBy) ids.add(d.reportedBy);
    if (d.reportedUserId) ids.add(d.reportedUserId);
  }
  const users = await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, username: true, underReviewAt: true, underReviewReason: true } });
  const name = new Map(users.map((u) => [u.id, u.username]));
  const review = new Map(users.filter((u) => u.underReviewAt).map((u) => [u.id, u.underReviewReason ?? 'Hidden pending review']));
  const hidden = await db.user.findMany({
    where: { underReviewAt: { not: null }, isActive: true },
    orderBy: { underReviewAt: 'asc' },
    select: { id: true, username: true, underReviewAt: true, underReviewReason: true },
  });

  const reports = rows.map((r) => {
    const d = (r.data ?? {}) as { reportedBy?: string; reportedUserId?: string; reason?: string; details?: string; kind?: string };
    return {
      id: r.id,
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt?.toISOString() ?? null,
      reporterId: d.reportedBy ?? null,
      reporter: d.reportedBy ? name.get(d.reportedBy) ?? null : null,
      automatic: d.kind === 'AUTO',
      underReview: d.reportedUserId ? review.get(d.reportedUserId) ?? null : null,
      reportedUserId: d.reportedUserId ?? null,
      reported: d.reportedUserId ? name.get(d.reportedUserId) ?? null : null,
      reason: d.reason ?? null,
      details: typeof d.details === 'string' ? d.details : null,
      kind: d.kind ?? null,
    };
  });
  // Pending: oldest first (most overdue at the top). Resolved: newest first, last 50.
  const pending = reports.filter((r) => !r.isRead);
  const resolved = reports.filter((r) => r.isRead).reverse().slice(0, 50);

  return (
    <AdminReportsClient
      pending={pending}
      resolved={resolved}
      stats={stats}
      hidden={hidden.map((h) => ({ id: h.id, username: h.username, since: h.underReviewAt!.toISOString(), reason: h.underReviewReason ?? '' }))}
    />
  );
}
