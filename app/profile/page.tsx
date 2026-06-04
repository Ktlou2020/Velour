import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';

async function getProfile() {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/profile`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const profile = await getProfile();

  return <ProfileClient session={session} initialProfile={profile} />;
}
