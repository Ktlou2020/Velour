import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MembersContent from './MembersContent';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

type SearchParams = Record<string, string | undefined> & {
  gender?: string;
  ageMin?: string;
  ageMax?: string;
  city?: string;
  online?: string;
  page?: string;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 12;
  const skip = (page - 1) * limit;

  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? '';
  const userRole = (session?.user as { role?: string })?.role;

  // Get caller profile for city restriction + pass to client
  const callerProfile = userId
    ? await db.profile.findUnique({
        where: { userId },
        select: { membershipTier: true, city: true, country: true },
      })
    : null;

  const membershipTier = (callerProfile?.membershipTier ?? 'FREE') as 'FREE' | 'GOLD' | 'PLATINUM';
  const profileCity = callerProfile?.city ?? '';
  const profileCountry = callerProfile?.country ?? '';
  const canChangeCity = userRole === 'ADMIN' || membershipTier === 'GOLD' || membershipTier === 'PLATINUM';

  // City: GOLD/PLATINUM can filter; FREE are locked to their own city (or no filter if city unset)
  const effectiveCity = canChangeCity ? (params.city ?? '') : profileCity;

  // Build profile filter
  const profileWhere: Prisma.ProfileWhereInput = {};

  if (params.gender && params.gender !== 'ALL') {
    profileWhere.gender = params.gender as 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER';
  }
  if (effectiveCity) {
    profileWhere.city = { contains: effectiveCity, mode: 'insensitive' };
  }
  if (params.online === '1') {
    profileWhere.isOnline = true;
  }
  if (params.ageMin || params.ageMax) {
    const now = new Date();
    if (params.ageMax) {
      const minDob = new Date(now);
      minDob.setFullYear(minDob.getFullYear() - parseInt(params.ageMax, 10) - 1);
      profileWhere.dateOfBirth = { ...((profileWhere.dateOfBirth as object) ?? {}), gte: minDob };
    }
    if (params.ageMin) {
      const maxDob = new Date(now);
      maxDob.setFullYear(maxDob.getFullYear() - parseInt(params.ageMin, 10));
      profileWhere.dateOfBirth = { ...((profileWhere.dateOfBirth as object) ?? {}), lte: maxDob };
    }
  }

  // Exclude blocked users
  const blocks = userId
    ? await db.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      })
    : [];
  const excludedIds = blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));

  const userWhere: Prisma.UserWhereInput = {
    ...(userId ? { id: { not: userId, notIn: excludedIds.length ? excludedIds : undefined } } : {}),
    isActive: true,
    profile: profileWhere,
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        isVerified: true,
        profile: {
          select: {
            displayName: true,
            profilePhoto: true,
            city: true,
            country: true,
            gender: true,
            membershipTier: true,
            isOnline: true,
            lastSeen: true,
            dateOfBirth: true,
          },
        },
        photos: {
          where: { isProfile: true, isPrivate: false },
          take: 1,
          select: { url: true },
        },
      },
      skip,
      take: limit,
      orderBy: [{ profile: { isOnline: 'desc' } }, { profile: { lastSeen: 'desc' } }],
    }),
    db.user.count({ where: userWhere }),
  ]);

  const members: MemberData[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.profile?.displayName ?? undefined,
    age: u.profile?.dateOfBirth
      ? Math.floor((Date.now() - new Date(u.profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined,
    city: u.profile?.city ?? undefined,
    country: u.profile?.country ?? undefined,
    isOnline: u.profile?.isOnline ?? undefined,
    membershipTier: u.profile?.membershipTier as MemberData['membershipTier'],
    profilePhotoUrl: u.photos[0]?.url ?? u.profile?.profilePhoto ?? undefined,
  }));

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <h1 className="font-serif text-4xl font-bold text-white mb-2">Browse Members</h1>
            <p className="text-white/50">Discover extraordinary people from around the world</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">Members online now</span>
            </div>
          </div>
        </div>
        <Suspense fallback={<div className="text-white/30 text-center py-20">Loading members...</div>}>
          <MembersContent
            members={members}
            total={total}
            currentPage={page}
            searchParams={{ ...params, city: effectiveCity }}
            canChangeCity={canChangeCity}
            profileCity={profileCity}
            profileCountry={profileCountry}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export interface MemberData {
  id?: string;
  username: string;
  displayName?: string;
  age?: number;
  city?: string;
  country?: string;
  isOnline?: boolean;
  membershipTier?: 'FREE' | 'GOLD' | 'PLATINUM';
  profilePhotoUrl?: string;
  interests?: string[];
}
