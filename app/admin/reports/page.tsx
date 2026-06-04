import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import AdminReportsClient from './AdminReportsClient';

export default async function AdminReportsPage() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id || sessionUser.role !== 'ADMIN') {
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
