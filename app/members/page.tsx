import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MembersContent from './MembersContent';

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
  const page = parseInt(params.page || '1', 10);

  const qs = new URLSearchParams({
    ...(params.gender && params.gender !== 'ALL' ? { gender: params.gender } : {}),
    ...(params.ageMin ? { ageMin: params.ageMin } : {}),
    ...(params.ageMax ? { ageMax: params.ageMax } : {}),
    ...(params.city ? { city: params.city } : {}),
    ...(params.online === '1' ? { online: '1' } : {}),
    page: String(page),
    limit: '12',
  });

  let members: MemberData[] = [];
  let total = 0;

  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/members?${qs.toString()}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      members = data.members || data || [];
      total = data.total || members.length;
    }
  } catch {
    // use empty state
  }

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
          <MembersContent members={members} total={total} currentPage={page} searchParams={params} />
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
