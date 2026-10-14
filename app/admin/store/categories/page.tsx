import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import AdminCategoriesClient from './AdminCategoriesClient';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  if (!(await requireAdmin())) redirect('/members');
  return <AdminCategoriesClient />;
}
