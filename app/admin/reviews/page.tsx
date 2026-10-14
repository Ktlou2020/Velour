import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import AdminReviewsClient from './AdminReviewsClient';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  // Role is checked against the database, not just the session token.
  const admin = await requireAdmin();
  if (!admin) redirect('/members');
  return <AdminReviewsClient />;
}
