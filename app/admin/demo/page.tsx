import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import DemoPhotosClient from './DemoPhotosClient';

export const metadata = { title: 'Demo profiles — Unbound admin' };

export default async function AdminDemoPage() {
  if (!(await requireAdmin())) redirect('/members');
  return <DemoPhotosClient />;
}
