import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import AdminUsersClient from './AdminUsersClient';

export default async function AdminUsersPage() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id || sessionUser.role !== 'ADMIN') {
    redirect('/members');
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          profilePhoto: true,
          membershipTier: true,
          lastSeen: true,
          isOnline: true,
        },
      },
    },
  });

  return <AdminUsersClient initialUsers={users} />;
}
