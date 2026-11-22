import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import MessagesReviewClient from './MessagesReviewClient';

export const metadata = { title: 'Message review — Unbound admin' };

export default async function AdminMessagesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/members');
  return <MessagesReviewClient isSuperAdmin={admin.isSuperAdmin} />;
}
