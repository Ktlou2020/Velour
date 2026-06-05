import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import MemberProfileClient from './MemberProfileClient';
import { sendPushToUser } from '@/lib/push';

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { username } = await params;
  const session = await auth();

  const currentUser = session?.user as { id?: string; username?: string } | undefined;
  if (currentUser?.username && currentUser.username === username) {
    redirect('/profile');
  }

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      createdAt: true,
      isVerified: true,
      profile: true,
      photos: {
        where: { isPrivate: false },
        orderBy: { order: 'asc' },
      },
      interests: { include: { interest: true } },
    },
  });

  if (!user) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <p className="text-white/50">Member not found.</p>
    </div>
  );

  // Track profile view (non-self, non-critical)
  if (currentUser?.id && user.id !== currentUser.id) {
    const viewerUsername = currentUser.username ?? '';
    db.profile.update({ where: { userId: user.id }, data: { profileViews: { increment: 1 } } }).catch(() => {});
    db.notification.create({
      data: {
        userId: user.id,
        type: 'PROFILE_VIEW',
        title: 'Someone viewed your profile',
        body: viewerUsername ? `@${viewerUsername} visited your profile` : 'A member visited your profile',
        data: { viewerId: currentUser.id, viewerUsername },
      },
    }).catch(() => {});
    sendPushToUser(user.id, {
      title: 'Someone viewed your profile',
      body: 'A member just visited your Velour profile',
      url: '/members',
      tag: `view-${currentUser.id}`,
    }).catch(() => {});
  }

  // Build flat profile object for the client component
  const profileData = {
    id: user.id,
    username: user.username,
    displayName: user.profile?.displayName ?? undefined,
    bio: user.profile?.bio ?? undefined,
    age: user.profile?.dateOfBirth
      ? Math.floor((Date.now() - new Date(user.profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined,
    city: user.profile?.city ?? undefined,
    country: user.profile?.country ?? undefined,
    gender: user.profile?.gender ?? undefined,
    orientation: user.profile?.orientation ?? undefined,
    relationshipStatus: user.profile?.relationshipStatus ?? undefined,
    lookingFor: user.profile?.lookingFor ?? [],
    isOnline: user.profile?.isOnline ?? false,
    isVerified: user.isVerified,
    membershipTier: (user.profile?.membershipTier ?? 'FREE') as 'FREE' | 'GOLD' | 'PLATINUM',
    profileViews: user.profile?.profileViews ?? 0,
    memberSince: user.createdAt.getFullYear().toString(),
    photos: user.photos,
    interests: user.interests.map(i => i.interest?.name ?? '').filter(Boolean),
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <MemberProfileClient username={username} profile={profileData} session={session} />
      </main>
      <Footer />
    </div>
  );
}
