import { db } from '@/lib/db';
import ProtectedImage from '@/components/ProtectedImage';
import Link from 'next/link';
import { MapPin, ArrowRight, Lock } from 'lucide-react';

/** Below this many members we don't show a count — small numbers read as "empty". */
const MIN_COUNT_TO_SHOW = 100;
/** Below this many public photos the grid looks sparse, so we skip the section. */
const MIN_FACES_TO_SHOW = 4;

type ShowcaseUser = {
  username: string;
  profile: {
    displayName: string | null;
    profilePhoto: string | null;
    city: string | null;
    isCouple: boolean;
  } | null;
  photos: Array<{ url: string }>;
};

/**
 * "Who's here" teaser on the public landing page, built only from real data.
 *
 * Privacy: photos are shown softly blurred and without links or ages —
 * visitors see that real people are here, members stay discreet. Incognito
 * and snoozed profiles are never included.
 *
 * Robustness: any DB error renders nothing (the landing page must never crash).
 */
export default async function MemberShowcase() {
  let users: ShowcaseUser[] = [];
  let memberCount = 0;

  try {
    const visible = {
      isActive: true,
      profile: { profilePhoto: { not: null }, incognito: false, isSnoozed: false },
    };
    [users, memberCount] = await Promise.all([
      db.user.findMany({
        where: visible,
        select: {
          username: true,
          profile: { select: { displayName: true, profilePhoto: true, city: true, isCouple: true } },
          photos: { where: { isProfile: true, isPrivate: false }, take: 1, select: { url: true } },
        },
        orderBy: [{ profile: { isOnline: 'desc' } }, { profile: { lastSeen: 'desc' } }],
        take: 8,
      }),
      db.user.count({ where: { isActive: true } }),
    ]);
  } catch {
    // DB unreachable (e.g. at build time or during an outage) — omit the section.
    return null;
  }

  const faces = users.filter((u) => u.photos[0]?.url || u.profile?.profilePhoto);
  if (faces.length < MIN_FACES_TO_SHOW) return null;
  const shown = faces.slice(0, faces.length >= 8 ? 8 : 4);

  return (
    <section aria-labelledby="community-heading" className="py-20 md:py-28 px-4 bg-[#0F0A1E]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <p className="eyebrow text-[#FF4D6D] mb-3">Who&apos;s here</p>
          <h2 id="community-heading" className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Real people, discreetly
          </h2>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">
            {memberCount >= MIN_COUNT_TO_SHOW
              ? `${memberCount.toLocaleString('en-ZA')} members and counting. `
              : ''}
            Photos stay blurred until you join — the same respect you&apos;ll get as a member.
          </p>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10">
          {shown.map((u) => {
            const photo = u.photos[0]?.url ?? u.profile?.profilePhoto ?? '';
            const name = (u.profile?.displayName || u.username).split(' ')[0];
            return (
              <li key={u.username} className="glass rounded-2xl overflow-hidden">
                <div className="relative aspect-[4/5] bg-white/5 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <ProtectedImage
                    src={photo}
                    alt=""
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover blur-md scale-110 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                    <Lock size={12} className="text-white/80" aria-hidden="true" />
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-white font-semibold text-sm truncate">
                    {u.profile?.isCouple ? `${name} · Couple` : name}
                  </p>
                  {u.profile?.city && (
                    <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin size={11} aria-hidden="true" />
                      <span className="truncate">{u.profile.city}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="text-center">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3.5 rounded-xl font-semibold transition-all"
          >
            Join to see who&apos;s here <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
