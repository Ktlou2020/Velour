import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { listTickets } from '@/lib/support-admin';
import SupportInboxClient from './SupportInboxClient';

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  // Role is checked against the database, not just the session token.
  const admin = await requireAdmin();
  if (!admin) redirect('/members');

  const initial = await listTickets('OPEN');
  return <SupportInboxClient initial={initial} />;
}
