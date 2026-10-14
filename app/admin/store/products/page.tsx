import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import AdminProductsClient from './AdminProductsClient';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  if (!(await requireAdmin())) redirect('/members');
  return <AdminProductsClient />;
}
