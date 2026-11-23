import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import PhotoReviewClient from './PhotoReviewClient';

export const metadata = { title: 'Photo review — Unbound admin' };

export default async function AdminPhotosPage() {
  if (!(await requireAdmin())) redirect('/members');
  return <PhotoReviewClient />;
}
