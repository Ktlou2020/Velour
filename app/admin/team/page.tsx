import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import TeamClient from './TeamClient';

export const metadata = { title: 'Admin team — Unbound admin' };

export default async function AdminTeamPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/members');
  return <TeamClient />;
}
