import Link from 'next/link';
import ProtectedImage from '@/components/ProtectedImage';
import { redirect } from 'next/navigation';
import { Eye, Check } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EmptyState from '@/components/EmptyState';
import BlurredPeople from '@/components/plans/BlurredPeople';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { entitlements, startOfWeekSAST } from '@/lib/plans';
import { getBlockedIds } from '@/app/api/members/search';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / DAY_MS)}d ago`;
}

interface ViewerRow {
  viewerId: string;
  count: number;
  last: Date;
}

export default async function ViewsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/signin?callbackUrl=/views');

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { membershipTier: true } } },
  });
  const ent = entitlements(me?.profile?.membershipTier, me?.role);

  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  const blocked = await getBlockedIds(userId);
  const views = await db.profileView.findMany({
    where: {
      viewedId: userId,
      createdAt: { gte: since },
      viewerId: { notIn: blocked },
      viewer: { isActive: true },
    },
    orderBy: { createdAt: 'desc' },
    select: { viewerId: true, createdAt: true },
    take: 5000,
  });

  // One row per viewer, newest first
  const byViewer = new Map<string, ViewerRow>();
  for (const v of views) {
    const row = byViewer.get(v.viewerId);
    if (row) row.count++;
    else byViewer.set(v.viewerId, { viewerId: v.viewerId, count: 1, last: v.createdAt });
  }
  const rows = [...byViewer.values()];
  const weekStart = startOfWeekSAST();
  const thisWeek = new Set(views.filter((v) => v.createdAt >= weekStart).map((v) => v.viewerId)).size;

  const viewers = ent.seeWhoViewedYou && rows.length
    ? await db.user.findMany({
        where: { id: { in: rows.slice(0, 200).map((r) => r.viewerId) } },
        select: {
          id: true,
          username: true,
          isVerified: true,
          profile: { select: { displayName: true, profilePhoto: true, city: true, isOnline: true } },
          photos: { where: { isProfile: true, isPrivate: false }, take: 1, select: { url: true } },
        },
      })
    : [];
  const viewerById = new Map(viewers.map((v) => [v.id, v]));

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-8 sm:py-12 px-4 border-b border-white/5">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Who viewed you</h1>
            <p className="text-white/65">Members who&apos;ve stopped by your profile in the last {WINDOW_DAYS} days.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {rows.length === 0 ? (
            <EmptyState
              icon={Eye}
              title="No visitors just yet"
              description="Profiles with a few photos, a status and answered prompts get noticed far more. A quick polish now goes a long way."
              action={{ label: 'Polish my profile', href: '/profile' }}
              secondaryAction={{ label: 'Browse members', href: '/members' }}
            />
          ) : !ent.seeWhoViewedYou ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-white">{thisWeek}</p>
                  <p className="text-white/60 text-xs mt-1">{thisWeek === 1 ? 'person' : 'people'} this week</p>
                </div>
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-white">{rows.length}</p>
                  <p className="text-white/60 text-xs mt-1">in the last {WINDOW_DAYS} days</p>
                </div>
              </div>
              <BlurredPeople
                count={rows.length}
                shape="avatar"
                max={7}
                headline={thisWeek > 0
                  ? `${thisWeek} ${thisWeek === 1 ? 'person' : 'people'} viewed you this week`
                  : `${rows.length} ${rows.length === 1 ? 'person' : 'people'} viewed you recently`}
                body="Gold and Platinum show you exactly who stopped by — and when — so you can say hello to the people already curious about you."
              />
            </>
          ) : (
            <>
              <p className="text-white/60 text-sm mb-6">
                {rows.length} {rows.length === 1 ? 'person' : 'people'} viewed your profile
                {thisWeek > 0 && <> · <span className="text-white/80">{thisWeek} this week</span></>}
              </p>
              <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {rows.map((r) => {
                  const v = viewerById.get(r.viewerId);
                  if (!v) return null;
                  const name = v.profile?.displayName || v.username;
                  const photo = v.photos[0]?.url ?? v.profile?.profilePhoto ?? null;
                  return (
                    <li key={r.viewerId}>
                      <Link href={`/members/${v.username}`} className="block glass rounded-2xl p-4 hover:bg-white/5 transition-colors group h-full">
                        <div className="relative w-16 h-16 mx-auto mb-3">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center overflow-hidden">
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <ProtectedImage src={photo} alt="" className="w-full h-full" />
                            ) : (
                              <span className="text-white font-bold text-xl">{name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          {v.profile?.isOnline && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0A0A0F]" title="Online" />}
                        </div>
                        <p className="text-white text-sm font-medium text-center truncate group-hover:text-[#FF4D6D] transition-colors flex items-center justify-center gap-1">
                          <span className="truncate">{name}</span>
                          {v.isVerified && <Check size={12} className="text-blue-400 flex-shrink-0" aria-label="Verified" />}
                        </p>
                        {v.profile?.city && <p className="text-white/60 text-xs text-center truncate mt-0.5">{v.profile.city}</p>}
                        <p className="text-white/45 text-xs text-center mt-1">
                          {timeAgo(r.last)}{r.count > 1 && <> · {r.count} visits</>}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
