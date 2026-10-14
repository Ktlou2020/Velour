import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import AdminOrdersClient from './AdminOrdersClient';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  if (!(await requireAdmin())) redirect('/members');
  return <AdminOrdersClient />;
}
