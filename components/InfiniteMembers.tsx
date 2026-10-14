'use client';

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, Check, Zap, Navigation, Plane, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';
import ProtectedImage from '@/components/ProtectedImage';
import StatusPill from '@/components/status/StatusPill';
import { RatingChip } from '@/components/reviews/Stars';
import type { MemberData } from '@/app/members/page';

type FilterState = Record<string, string | undefined> & {
  gender?: string;
  show?: string;
  coupleType?: string;
  ageMin?: string;
  ageMax?: string;
  city?: string;
  online?: string;
  sort?: string;
  maxKm?: string;
  anyCity?: string;
  radius?: string;
};

// Pass-through params (advanced filters are applied server-side for Gold+ only)
const PASS_KEYS = ['radius', 'anyCity', 'heightMin', 'heightMax', 'bodyType', 'intentions', 'languages', 'verified', 'photos', 'active'] as const;

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
  FREE: 'text-white/60',
  GOLD: 'text-[#D4AF37]',
  PLATINUM: 'text-purple-400',
};


function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

/** One member card (grid tile). Also used by the /members spotlight row. */
export function MemberTile({ member, watermark }: { member: MemberData; watermark: string }) {
  const memberExt = member as MemberData & { dateOfBirth?: string };
  const age = member.isCouple && member.ages?.length
    ? member.ages.join(' & ')
    : member.age ?? (memberExt.dateOfBirth ? calcAge(memberExt.dateOfBirth) : undefined);
  const tier = member.membershipTier ?? 'FREE';
  const initials = (member.displayName || member.username || '?').slice(0, 2).toUpperCase();

  const isVerified = (member as MemberData & { isVerified?: boolean }).isVerified;

  return (
    <Link
      href={`/members/${member.username}`}
      className="glass rounded-2xl overflow-hidden hover:bg-white/5 transition-all hover:scale-[1.02] group"
    >
      {/* Photo */}
      <div className="aspect-[3/4] relative bg-gradient-to-br from-rose-950 to-[#0A0A0F] flex items-center justify-center overflow-hidden">
        {member.profilePhotoUrl ? (
          <ProtectedImage
            src={member.profilePhotoUrl}
            alt={member.username}
            className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            watermark={watermark}
          />
        ) : (
          <span className="text-white/55 text-4xl font-bold font-serif">{initials}</span>
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

        {/* Spotlight / boosted / visiting badges */}
        {(member.isSpotlight || member.isBoosted || member.visiting) && (
          <div className={`absolute ${tier !== 'FREE' ? 'top-9' : 'top-2'} left-2 z-10 flex flex-col items-start gap-1`}>
            {member.isSpotlight && (
              <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-purple-600/90 to-[#B8960C]/90 text-white backdrop-blur-sm" title="Platinum spotlight">
                <Sparkles size={9} aria-hidden="true" />
                SPOTLIGHT
              </div>
            )}
            {member.isBoosted && (
              <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#DC143C]/80 text-white backdrop-blur-sm" title="Boosted">
                <Zap size={9} className="fill-white" />
                BOOST
              </div>
            )}
            {member.visiting && (
              <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/80 text-white backdrop-blur-sm" title={`Visiting ${member.visiting.city} until ${shortDate(member.visiting.until)}`}>
                <Plane size={9} aria-hidden="true" />
                VISITING
              </div>
            )}
          </div>
        )}

        {/* Compatibility + review score */}
        {((typeof member.compatibility === 'number' && member.compatibility > 0) || member.rating) && (
          <div className="absolute bottom-2 left-2 right-8 z-10 flex flex-wrap items-center gap-1">
            {typeof member.compatibility === 'number' && member.compatibility > 0 && (
              <div
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md glass ${
                  member.compatibility >= 70 ? 'text-[#D4AF37]' : 'text-white/70'
                }`}
                title={member.compatibilityReasons?.join(' · ') || 'Compatibility'}
              >
                {member.compatibility}% match
              </div>
            )}
            <RatingChip rating={member.rating} className="!py-0.5" />
          </div>
        )}

        {/* Couple badge */}
        {member.isCouple && (
          <div className="absolute top-2 right-7 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-md glass text-[#D4AF37]" title="Couple profile">
            {member.coupleBadge ?? 'Couple'}
          </div>
        )}

        {/* Verified badge */}
        {isVerified && (
          <div
            className="absolute bottom-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#0A0A0F]"
            title="Verified Member"
          >
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-white text-sm font-semibold truncate">
          {member.displayName || member.username}
          {age ? <span className="text-white/65 font-normal">, {age}</span> : ''}
        </p>
        {member.pronouns && <p className="text-white/50 text-[11px] truncate">{member.pronouns}</p>}
        {member.status && <StatusPill status={{ emoji: member.status.emoji ?? null, text: member.status.text }} size="sm" className="mt-1" />}
        {member.city && (
          <div className="flex items-center gap-1 text-white/55 text-xs mt-0.5">
            <MapPin size={10} />
            <span className="truncate">{member.visiting ? `Visiting ${member.city}` : member.city}</span>
          </div>
        )}
        {member.distance && (
          <div className="flex items-center gap-1 text-white/60 text-xs mt-0.5">
            <Navigation size={9} />
            <span className="truncate">{member.distance}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function InfiniteMembers({ initialMembers, filters }: Props) {
  const { data: session } = useSession();
  const watermark = (session?.user as { username?: string })?.username ?? session?.user?.email ?? 'hush';
  const [members, setMembers] = useState<MemberData[]>(initialMembers);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMembers.length >= 12);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset when the server re-renders with a new filter set
  useEffect(() => {
    setMembers(initialMembers);
    setPage(1);
    setHasMore(initialMembers.length >= 12);
  }, [initialMembers]);

  // Stable filter key so fetchMore doesn't recreate on every render
  const filterKey = useMemo(
    () => [filters.gender, filters.show, filters.coupleType, filters.ageMin, filters.ageMax, filters.city, filters.online, filters.sort, filters.maxKm, ...PASS_KEYS.map((k) => filters[k])].join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.gender, filters.show, filters.coupleType, filters.ageMin, filters.ageMax, filters.city, filters.online, filters.sort, filters.maxKm, ...PASS_KEYS.map((k) => filters[k])]
  );

  const fetchMore = useCallback(async (nextPage: number) => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ...(filters.gender && filters.gender !== 'ALL' ? { gender: filters.gender } : {}),
        ...(filters.show ? { show: filters.show } : {}),
        ...(filters.coupleType ? { coupleType: filters.coupleType } : {}),
        ...(filters.ageMin ? { ageMin: filters.ageMin } : {}),
        ...(filters.ageMax ? { ageMax: filters.ageMax } : {}),
        ...(filters.city ? { city: filters.city } : {}),
        ...(filters.online === '1' ? { online: '1' } : {}),
        ...(filters.sort ? { sort: filters.sort } : {}),
        ...(filters.maxKm ? { maxKm: filters.maxKm } : {}),
        page: String(nextPage),
        limit: '12',
      });
      for (const k of PASS_KEYS) { const v = filters[k]; if (v) qs.set(k, v); }
      const res = await fetch(`/api/members?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json() as { members?: MemberData[]; total?: number };
        const newMembers = data.members || [];
        // Boosted profiles are prepended on page 1, so dedupe by id
        setMembers((prev) => {
          const seen = new Set(prev.map((m) => m.id ?? m.username));
          return [...prev, ...newMembers.filter((m) => !seen.has(m.id ?? m.username))];
        });
        setHasMore(newMembers.length >= 12);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore, filterKey]);

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
          // With a radius applied, members without a location come last under their own heading.
          const firstUnknown = !!filters.radius && member.distanceKm === undefined && !member.visiting
            && (idx === 0 || members[idx - 1].distanceKm !== undefined || !!members[idx - 1].visiting);
          // Members beyond the radius come at the very end under "Further away".
          const firstFurther = !!member.beyondRadius && (idx === 0 || !members[idx - 1].beyondRadius);
          return (
            <Fragment key={`${member.username}-${idx}`}>
              {firstUnknown && (
                <div className="col-span-full pt-4">
                  <h3 className="text-white/80 text-sm font-semibold">Distance unknown</h3>
                  <p className="text-white/50 text-xs">These members haven&apos;t shared a location yet, so we can&apos;t say how far away they are.</p>
                </div>
              )}
              {firstFurther && (
                <div className="col-span-full pt-4">
                  <h3 className="text-white/80 text-sm font-semibold">Further away</h3>
                  <p className="text-white/50 text-xs">Outside {filters.radius && filters.radius !== 'any' ? `${filters.radius} km` : 'your search radius'}, nearest first.</p>
                </div>
              )}
              <MemberTile member={member} watermark={watermark} />
            </Fragment>
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
        <p className="text-center text-white/45 text-sm py-8">No more members to show</p>
      )}
    </div>
  );
}
