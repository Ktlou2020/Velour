import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import MemberProfileClient from './MemberProfileClient';
import { sendPushToUser } from '@/lib/push';
import { compatibility, ageFromDob } from '@/lib/compat';
import { distanceKm, formatDistance } from '@/lib/geo';
import { parsePrompts } from '@/app/profile/prompts';
import { isPlatinum } from '@/lib/premium';

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
      profile: {
        select: {
          displayName: true, bio: true, dateOfBirth: true, gender: true, orientation: true,
          relationshipStatus: true, lookingFor: true, city: true, country: true,
          isOnline: true, membershipTier: true, profileViews: true,
          latitude: true, longitude: true, videoUrl: true, prompts: true,
        },
      },
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

  // Viewer data: incognito flag + compatibility inputs
  const viewer = currentUser?.id && currentUser.id !== user.id
    ? await db.user.findUnique({
        where: { id: currentUser.id },
        select: {
          username: true,
          role: true,
          profile: {
            select: {
              membershipTier: true,
              incognito: true, lookingFor: true, dateOfBirth: true, city: true,
              latitude: true, longitude: true,
            },
          },
          interests: { include: { interest: true } },
        },
      })
    : null;

  // Track profile view (non-self, non-incognito, non-critical)
  if (currentUser?.id && viewer && !viewer.profile?.incognito) {
    const viewerId = currentUser.id;
    const viewerUsername = viewer.username ?? currentUser.username ?? '';
    db.profile.update({ where: { userId: user.id }, data: { profileViews: { increment: 1 } } }).catch(() => {});
    // Deduplicate notifications per viewer per 24h
    (async () => {
      const existing = await db.notification.findFirst({
        where: {
          userId: user.id,
          type: 'PROFILE_VIEW',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          data: { path: ['viewerId'], equals: viewerId },
        },
        select: { id: true },
      });
      if (existing) return;
      await db.notification.create({
        data: {
          userId: user.id,
          type: 'PROFILE_VIEW',
          title: 'Someone viewed your profile',
          body: viewerUsername ? `@${viewerUsername} visited your profile` : 'A member visited your profile',
          data: { viewerId, viewerUsername },
        },
      });
      await sendPushToUser(user.id, {
        title: 'Someone viewed your profile',
        body: 'A member just visited your Velour profile',
        url: '/views',
        tag: `view-${viewerId}`,
      });
    })().catch(() => {});
  }

  // Compatibility + coarse distance (raw coordinates never leave the server)
  const ownerInterests = user.interests.map(i => i.interest?.name ?? '').filter(Boolean);
  let compat: { score: number; reasons: string[]; sharedInterests: string[] } | undefined;
  let distanceLabel: string | undefined;
  if (viewer) {
    const vp = viewer.profile;
    const op = user.profile;
    compat = compatibility(
      {
        interests: viewer.interests.map(i => i.interest?.name ?? '').filter(Boolean),
        lookingFor: vp?.lookingFor ?? [],
        age: ageFromDob(vp?.dateOfBirth),
        city: vp?.city,
        latitude: vp?.latitude,
        longitude: vp?.longitude,
      },
      {
        interests: ownerInterests,
        lookingFor: op?.lookingFor ?? [],
        age: ageFromDob(op?.dateOfBirth),
        city: op?.city,
        latitude: op?.latitude,
        longitude: op?.longitude,
      },
    );
    if (vp?.latitude != null && vp?.longitude != null && op?.latitude != null && op?.longitude != null) {
      distanceLabel = formatDistance(distanceKm(vp.latitude, vp.longitude, op.latitude, op.longitude)) ?? undefined;
    }
  }

  const insights = !!viewer && isPlatinum(viewer.profile?.membershipTier, viewer.role);

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
    interests: ownerInterests,
    videoUrl: user.profile?.videoUrl ?? undefined,
    prompts: parsePrompts(user.profile?.prompts),
    compatibilityScore: compat?.score,
    // Detailed insights are a Platinum perk; everyone signed in sees the score
    compatibilityReasons: insights ? compat?.reasons ?? [] : [],
    sharedInterests: insights ? compat?.sharedInterests ?? [] : [],
    insightsLocked: !!compat && !insights,
    distance: distanceLabel,
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
