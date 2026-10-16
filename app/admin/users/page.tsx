import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { isSuperAdminEmail } from '@/lib/admin-roles';
import AdminUsersClient from './AdminUsersClient';

export default async function AdminUsersPage() {
  // Role is checked against the database, not just the session token.
  const admin = await requireAdmin();
  if (!admin) {
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
      isDemo: true,
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

  return (
    <AdminUsersClient
      initialUsers={users.map((u) => ({ ...u, isSuperAdmin: isSuperAdminEmail(u.email) }))}
      viewerId={admin.id}
      viewerIsSuperAdmin={admin.isSuperAdmin}
    />
  );
}
