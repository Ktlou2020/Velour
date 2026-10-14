import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MembersContent from './MembersContent';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getCallerContext, searchMembers, type MemberResult } from '@/app/api/members/search';

type SearchParams = Record<string, string | undefined> & {
  gender?: string;
  ageMin?: string;
  ageMax?: string;
  city?: string;
  online?: string;
  sort?: string;
  page?: string;
  maxKm?: string;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 12;

  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? '';
  const userRole = (session?.user as { role?: string })?.role;

  const caller = await getCallerContext(userId, userRole);
  const callerProfile = userId
    ? await db.profile.findUnique({
        where: { userId },
        select: { city: true, country: true },
      })
    : null;

  const profileCity = callerProfile?.city ?? '';
  const profileCountry = callerProfile?.country ?? '';
  const canChangeCity = caller.paid;

  // City: GOLD/PLATINUM can filter; FREE are locked to their own city (or no filter if city unset)
  const result = await searchMembers(caller, {
    page: String(page),
    limit: String(limit),
    gender: params.gender,
    ageMin: params.ageMin,
    ageMax: params.ageMax,
    city: params.city,
    online: params.online,
    sort: params.sort,
    maxKm: params.maxKm,
  });
  const effectiveCity = result.effectiveCity ?? '';
  const total = result.total;
  const members: MemberData[] = result.members;

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
            callerHasLocation={result.callerHasLocation}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export type MemberData = Partial<Omit<MemberResult, 'username'>> & {
  username: string;
};
