import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect('/auth/signin');

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      isVerified: true,
      profile: true,
      photos: { orderBy: { order: 'asc' } },
      interests: { include: { interest: true } },
    },
  });

  if (!user) redirect('/auth/signin');

  const profile = user.profile;

  const initialProfile = {
    id: user.id,
    username: user.username,
    displayName: profile?.displayName ?? undefined,
    bio: profile?.bio ?? undefined,
    city: profile?.city ?? undefined,
    country: profile?.country ?? undefined,
    orientation: profile?.orientation ?? undefined,
    lookingFor: profile?.lookingFor ?? [],
    membershipTier: (profile?.membershipTier ?? 'FREE') as 'FREE' | 'GOLD' | 'PLATINUM',
    profileViews: profile?.profileViews ?? 0,
    completeness: profile?.profileCompleteness ?? 0,
    isCouple: profile?.isCouple ?? false,
    partnerId: profile?.partnerId ?? null,
    photos: user.photos.map(p => ({
      id: p.id,
      url: p.url,
      isProfile: p.isProfile,
      isPrivate: p.isPrivate,
    })),
  };

  return <ProfileClient session={session} initialProfile={initialProfile} />;
}
