import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import AdminReportsClient from './AdminReportsClient';

export default async function AdminReportsPage() {
  // Role is checked against the database, not just the session token.
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/members');
  }

  const reports = await db.notification.findMany({
    where: { type: 'REPORT' },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
  });

  return <AdminReportsClient reports={reports} />;
}
