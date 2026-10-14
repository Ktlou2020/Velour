import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import MemberProfileClient from './MemberProfileClient';
import { recordProfileView } from '@/lib/views';
import { activeStatus } from '@/components/status/status';
import { earnedForDisplay, loadBadges } from '@/lib/badges';
import { loadSparkAnswers } from '@/app/api/spark/data';
import { compatibility, ageFromDob } from '@/lib/compat';
import { distanceKm, formatDistance } from '@/lib/geo';
import { parsePrompts } from '@/app/profile/prompts';
import { isPlatinum } from '@/lib/premium';
import { categoryOf, effectiveInterestedIn, publicIdentity } from '@/lib/identity';

const PERSON_FIELDS = {
  displayName: true, dateOfBirth: true, gender: true, genderLabel: true, pronouns: true,
  orientation: true, showGender: true, showOrientation: true, heightCm: true, bodyType: true,
  ethnicity: true, showEthnicity: true, languages: true, drinking: true, smoking: true,
} as const;

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
      isActive: true,
      profile: {
        select: {
          ...PERSON_FIELDS,
          bio: true, relationshipStatus: true, lookingFor: true, city: true, country: true,
          isOnline: true, membershipTier: true, profileViews: true,
          latitude: true, longitude: true, videoUrl: true, prompts: true,
          interestedIn: true, intentions: true, isCouple: true, coupleType: true,
          coupleMembers: true, hasChildren: true,
          statusText: true, statusEmoji: true, statusUntil: true,
          partner: { select: { ...PERSON_FIELDS, user: { select: { username: true, isActive: true } } } },
        },
      },
      photos: {
        where: { isPrivate: false },
        orderBy: { order: 'asc' },
      },
      interests: { include: { interest: true } },
    },
  });

  // Blocked either way → behave as if the member doesn't exist.
  const blocked = user && currentUser?.id && currentUser.id !== user.id
    ? await db.block.findFirst({
        where: { OR: [{ blockerId: currentUser.id, blockedId: user.id }, { blockerId: user.id, blockedId: currentUser.id }] },
        select: { id: true },
      })
    : null;

  // Deactivated accounts are hidden like blocked ones.
  if (!user || blocked || !user.isActive) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <p className="text-white/65">Member not found.</p>
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
              incognito: true, lookingFor: true, interestedIn: true, intentions: true,
              isCouple: true, gender: true, dateOfBirth: true, city: true,
              latitude: true, longitude: true,
            },
          },
          interests: { include: { interest: true } },
        },
      })
    : null;

  // Track the view: deduped per 24h, never for incognito viewers; members
  // who can see their viewers are notified (all inside recordProfileView).
  const [badges, sparkAnswers] = await Promise.all([
    loadBadges(user.id),
    loadSparkAnswers(user.id, 3),
    currentUser?.id && viewer ? recordProfileView(currentUser.id, user.id) : Promise.resolve(),
  ]);

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
        category: vp ? categoryOf(vp) : null,
        interestedIn: vp ? effectiveInterestedIn(vp) : [],
        intentions: vp?.intentions ?? [],
        age: ageFromDob(vp?.dateOfBirth),
        city: vp?.city,
        latitude: vp?.latitude,
        longitude: vp?.longitude,
      },
      {
        interests: ownerInterests,
        category: op ? categoryOf(op) : null,
        interestedIn: op ? effectiveInterestedIn(op) : [],
        intentions: op?.intentions ?? [],
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

  // Public identity: hidden gender / orientation / ethnicity are removed here,
  // on the server, so they never reach the browser.
  const op = user.profile;
  const partner = op?.partner && op.partner.user?.isActive !== false
    ? { ...op.partner, username: op.partner.user?.username ?? null }
    : null;
  const identity = op ? publicIdentity(op, partner) : undefined;

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
    relationshipStatus: user.profile?.relationshipStatus ?? undefined,
    identity,
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
    status: activeStatus(user.profile),
    // The hero already shows the Verified pill.
    badges: earnedForDisplay(badges).filter((b) => b.id !== 'verified'),
    sparkAnswers,
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
