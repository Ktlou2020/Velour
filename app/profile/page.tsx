import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import ProfileClient from './ProfileClient';
import { isPaid, isPlatinum } from '@/lib/premium';
import { parsePrompts } from './prompts';
import { completenessOf, effectiveInterestedIn, parseCoupleMembers, personFromProfile } from '@/lib/identity';
import { activeStatus } from '@/components/status/status';
import { loadBadges } from '@/lib/badges';
import { loadSparkAnswers } from '@/app/api/spark/data';
import { todaySpark } from '@/lib/spark';
import type { StrengthFacts } from './strength';

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
      role: true,
      profile: { include: { partner: { select: { displayName: true, user: { select: { username: true, isActive: true } } } } } },
      photos: { orderBy: { order: 'asc' } },
      interests: { include: { interest: true } },
    },
  });

  if (!user) redirect('/auth/signin');

  const today = todaySpark();
  const [badges, sparkAnswers] = await Promise.all([
    loadBadges(user.id),
    loadSparkAnswers(user.id, 4),
  ]);
  const sparkAnsweredToday = sparkAnswers.some((a) => a.key === today.key);

  const profile = user.profile;
  const members = parseCoupleMembers(profile?.coupleMembers);
  const me = profile ? personFromProfile(profile) : { showGender: true, showOrientation: true };
  const linkedPartner = profile?.partner?.user && profile.partner.user.isActive !== false
    ? { username: profile.partner.user.username, displayName: profile.partner.displayName }
    : null;
  // Couples sharing an account keep partner 1's name etc. in coupleMembers[0];
  // the main profile fields mirror partner 1.
  const person = profile?.isCouple && !linkedPartner && members[0]
    ? { ...me, ...members[0], dateOfBirth: me.dateOfBirth }
    : me;

  const hasMainPhoto = user.photos.some((p) => p.isProfile) || !!profile?.profilePhoto;
  const strength: StrengthFacts = {
    missing: completenessOf(profile, hasMainPhoto).missing,
    publicPhotos: user.photos.filter((p) => !p.isPrivate).length,
    prompts: parsePrompts(profile?.prompts).length,
    hasIntentions: (profile?.intentions?.length ?? 0) > 0,
    isCouple: !!profile?.isCouple,
    hasPersonalTouch: profile?.isCouple ? (!!linkedPartner || !!members[1]) : !!profile?.pronouns,
    sparkAnsweredToday,
  };

  const initialProfile = {
    id: user.id,
    username: user.username,
    isVerified: user.isVerified,
    displayName: profile?.displayName ?? undefined,
    bio: profile?.bio ?? undefined,
    city: profile?.city ?? undefined,
    country: profile?.country ?? undefined,
    pronouns: profile?.pronouns ?? null,
    identity: {
      isCouple: profile?.isCouple ?? false,
      linkedPartner,
      dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
      person,
      partner2: members[1] ?? null,
      coupleType: profile?.coupleType ?? null,
      interestedIn: profile ? effectiveInterestedIn(profile) : [],
      intentions: profile?.intentions ?? [],
      hasChildren: profile?.hasChildren ?? null,
    },
    membershipTier: (profile?.membershipTier ?? 'FREE') as 'FREE' | 'GOLD' | 'PLATINUM',
    profileViews: profile?.profileViews ?? 0,
    completeness: profile?.profileCompleteness ?? 0,
    isCouple: profile?.isCouple ?? false,
    partnerId: profile?.partnerId ?? null,
    prompts: parsePrompts(profile?.prompts),
    videoUrl: profile?.videoUrl ?? null,
    incognito: profile?.incognito ?? false,
    showChatImages: profile?.showChatImages ?? false,
    hasLocation: profile?.latitude != null && profile?.longitude != null,
    isPaid: isPaid(profile?.membershipTier, user.role),
    isPlatinum: isPlatinum(profile?.membershipTier, user.role),
    status: activeStatus(profile),
    badges,
    strength,
    sparkAnswers: sparkAnswers.slice(0, 3),
    photos: user.photos.map(p => ({
      id: p.id,
      url: p.url,
      isProfile: p.isProfile,
      isPrivate: p.isPrivate,
    })),
  };

  return <ProfileClient session={session} initialProfile={initialProfile} />;
}
