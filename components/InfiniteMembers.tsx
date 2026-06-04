'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { MemberData } from '@/app/members/page';

type FilterState = Record<string, string | undefined> & {
  gender?: string;
  ageMin?: string;
  ageMax?: string;
  city?: string;
  online?: string;
};

interface Props {
  initialMembers: MemberData[];
  filters: FilterState;
}

function calcAge(dateOfBirth?: string | Date | null): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

const TIER_COLORS: Record<string, string> = {
  FREE: 'text-white/40',
  GOLD: 'text-[#D4AF37]',
  PLATINUM: 'text-purple-400',
};

export default function InfiniteMembers({ initialMembers, filters }: Props) {
  const [members, setMembers] = useState<MemberData[]>(initialMembers);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMembers.length >= 12);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchMore = useCallback(async (nextPage: number) => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ...(filters.gender && filters.gender !== 'ALL' ? { gender: filters.gender } : {}),
        ...(filters.ageMin ? { ageMin: filters.ageMin } : {}),
        ...(filters.ageMax ? { ageMax: filters.ageMax } : {}),
        ...(filters.city ? { city: filters.city } : {}),
        ...(filters.online === '1' ? { online: '1' } : {}),
        page: String(nextPage),
        limit: '12',
      });
      const res = await fetch(`/api/members?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json() as { members?: MemberData[]; total?: number };
        const newMembers = data.members || [];
        setMembers((prev) => [...prev, ...newMembers]);
        setHasMore(newMembers.length >= 12);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, filters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          fetchMore(page + 1);
        }
      },
      { rootMargin: '200px' }
    );

    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [fetchMore, hasMore, loading, page]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {members.map((member, idx) => {
          const memberExt = member as MemberData & { dateOfBirth?: string };
          const age = member.age ?? (memberExt.dateOfBirth ? calcAge(memberExt.dateOfBirth) : undefined);
          const tier = member.membershipTier ?? 'FREE';
          const initials = (member.displayName || member.username || '?').slice(0, 2).toUpperCase();

          return (
            <Link
              key={`${member.username}-${idx}`}
              href={`/members/${member.username}`}
              className="glass rounded-2xl overflow-hidden hover:bg-white/5 transition-all hover:scale-[1.02] group"
            >
              {/* Photo */}
              <div className="aspect-[3/4] relative bg-gradient-to-br from-rose-950 to-[#0A0A0F] flex items-center justify-center overflow-hidden">
                {member.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.profilePhotoUrl}
                    alt={member.username}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="text-white/30 text-4xl font-bold font-serif">{initials}</span>
                )}

                {/* Online dot */}
                {member.isOnline && (
                  <div className="absolute top-2 right-2 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0A0A0F] animate-pulse" />
                )}

                {/* Tier badge */}
                {tier !== 'FREE' && (
                  <div className={`absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded-md glass ${TIER_COLORS[tier]}`}>
                    {tier === 'GOLD' ? '✦ GOLD' : '◆ PLAT'}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-white text-sm font-semibold truncate">
                  {member.displayName || member.username}
                  {age ? <span className="text-white/50 font-normal">, {age}</span> : ''}
                </p>
                {member.city && (
                  <div className="flex items-center gap-1 text-white/30 text-xs mt-0.5">
                    <MapPin size={10} />
                    <span className="truncate">{member.city}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Sentinel + Loading */}
      <div ref={sentinelRef} className="h-1" />
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!hasMore && members.length > 0 && (
        <p className="text-center text-white/20 text-sm py-8">No more members to show</p>
      )}
    </div>
  );
}
