import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import VerificationClient from './VerificationClient';

export const metadata = { title: 'Verification — Unbound admin' };

export default async function AdminVerificationPage() {
  if (!(await requireAdmin())) redirect('/members');
  return <VerificationClient />;
}
