import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MemberCardSkeleton from '@/components/MemberCardSkeleton';
import MembersContent from './MembersContent';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getCallerContext, getSpotlight, searchMembers, type MemberResult } from '@/app/api/members/search';

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
        select: { city: true, country: true, latitude: true, longitude: true },
      })
    : null;

  const profileCity = callerProfile?.city ?? '';
  const profileCountry = callerProfile?.country ?? '';
  const canChangeCity = caller.ent.searchAnyCity;

  // Location-first: radius from the member's location (lib/plans maxSearchRadiusKm caps it)
  const result = await searchMembers(caller, {
    page: String(page),
    limit: String(limit),
    gender: params.gender,
    show: params.show,
    coupleType: params.coupleType,
    ageMin: params.ageMin,
    ageMax: params.ageMax,
    city: params.city,
    online: params.online,
    sort: params.sort,
    maxKm: params.maxKm,
    radius: params.radius,
    anyCity: params.anyCity,
    heightMin: params.heightMin,
    heightMax: params.heightMax,
    bodyType: params.bodyType,
    intentions: params.intentions,
    languages: params.languages,
    verified: params.verified,
    photos: params.photos,
    active: params.active,
  });
  // Platinum spotlight row (first page only)
  const spotlight = userId && page === 1 ? await getSpotlight(caller, { limit: 4 }).catch(() => []) : [];
  const effectiveCity = result.effectiveCity ?? '';
  const total = result.total;
  const members: MemberData[] = result.members;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-8 sm:py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Members</h1>
            <p className="text-white/65">Women, men, non-binary people and couples near you who&apos;d like to meet you too.</p>
          </div>
        </div>
        <Suspense fallback={
          <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => <MemberCardSkeleton key={i} />)}
          </div>
        }>
          <MembersContent
            members={members}
            total={total}
            currentPage={page}
            searchParams={{ ...params, city: effectiveCity || undefined }}
            canChangeCity={canChangeCity}
            advancedFilters={caller.ent.advancedFilters}
            travel={caller.travel ? { city: caller.travel.city, until: caller.travel.until.toISOString() } : null}
            canTravel={caller.ent.travelMode}
            spotlight={spotlight}
            radiusKm={result.radiusKm}
            maxRadiusKm={caller.ent.maxSearchRadiusKm}
            sort={result.sort}
            unknownDistance={result.unknownDistance}
            inRadius={result.inRadius}
            furtherAway={result.furtherAway}
            homeLat={callerProfile?.latitude ?? null}
            homeLng={callerProfile?.longitude ?? null}
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
