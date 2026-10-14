import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Clock, MapPin, Rocket, Lock, Eye, Heart, Sparkles, MessageCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PlanChip from '@/components/plans/PlanChip';
import { auth } from '@/auth';
import { loadPlan } from '@/app/api/likes/limits';
import { getInsights, INSIGHT_DAYS } from '@/app/api/insights/data';
import { DailyBars, HBars, StatTile } from './charts';

export const dynamic = 'force-dynamic';

const COLORS = { views: '#FF4D6D', likes: '#D4AF37', matches: '#B794F4', messages: '#7DD3FC' };

function when(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
}

function Header({ locked }: { locked: boolean }) {
  return (
    <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-8 sm:py-12 px-4 border-b border-white/5">
      <div className="max-w-5xl mx-auto">
        <p className="eyebrow text-purple-300 mb-2 flex items-center gap-2"><BarChart3 size={13} aria-hidden="true" /> Platinum</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Profile insights</h1>
        <p className="text-white/65 max-w-2xl">
          {locked
            ? 'See how your profile is doing: views, likes, matches and messages over time, where your admirers are, and when you get the most attention.'
            : `How your profile has done over the last ${INSIGHT_DAYS} days.`}
        </p>
      </div>
    </div>
  );
}

/** Locked preview: the real layout with empty placeholders — no invented numbers. */
function LockedPreview() {
  const tiles = [
    { icon: Eye, label: 'Profile views' },
    { icon: Heart, label: 'Likes received' },
    { icon: Sparkles, label: 'New matches' },
    { icon: MessageCircle, label: 'Messages received' },
  ];
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {tiles.map(({ icon: Icon, label }) => (
            <div key={label} className="glass rounded-2xl p-4">
              <p className="text-white/50 text-xs flex items-center gap-1.5"><Icon size={12} /> {label}</p>
              <div className="h-8 w-16 rounded-lg skeleton mt-2" />
              <div className="h-2.5 w-24 rounded skeleton mt-2" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {[0, 1].map((k) => (
            <div key={k} className="glass rounded-2xl p-5">
              <div className="h-3 w-28 rounded skeleton mb-4" />
              <div className="flex items-end gap-[3px] h-24">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-white/[0.06]" style={{ height: '100%' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[0, 1, 2].map((k) => (
            <div key={k} className="glass rounded-2xl p-5 space-y-3">
              <div className="h-3 w-24 rounded skeleton" />
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-2.5 rounded-full bg-white/[0.06]" />)}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex items-start sm:items-center justify-center pt-10 sm:pt-0 bg-gradient-to-b from-[#0A0A0F]/40 via-[#0A0A0F]/75 to-[#0A0A0F]/40">
        <div className="glass-dark rounded-3xl border border-purple-400/25 p-6 sm:p-8 max-w-md mx-4 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-400/30 flex items-center justify-center mx-auto mb-4">
            <Lock size={22} className="text-purple-300" aria-hidden="true" />
          </div>
          <div className="flex justify-center mb-2"><PlanChip tier="PLATINUM" locked={false} /></div>
          <h2 className="font-serif text-white text-2xl font-bold mb-2">Know what&apos;s working</h2>
          <p className="text-white/65 text-sm leading-relaxed mb-5">
            Platinum shows your daily views, likes, matches and messages, the cities your admirers are in, and the best day and time to be online — plus a weekly boost to put it to use.
          </p>
          <Link href="/upgrade#compare" className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm">
            See Platinum
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/signin?callbackUrl=/insights');

  const plan = await loadPlan(userId);
  const locked = !plan.ent.profileInsights;
  const data = locked ? null : await getInsights(userId, { tier: plan.tier, role: plan.role, boostEveryDays: plan.ent.boostEveryDays });

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <Header locked={locked} />
        <div className="max-w-5xl mx-auto px-4 py-8">
          {!data ? <LockedPreview /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatTile label={`Profile views · ${data.totals.uniqueViewers} people`} value={data.totals.views} previous={data.previous.views} />
                <StatTile label="Likes received" value={data.totals.likes} previous={data.previous.likes} />
                <StatTile label="New matches" value={data.totals.matches} previous={data.previous.matches} />
                <StatTile label="Messages received" value={data.totals.messages} previous={data.previous.messages} />
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <DailyBars title="Profile views per day" series={data.series} metric="views" color={COLORS.views} total={data.totals.views} />
                <DailyBars title="Likes received per day" series={data.series} metric="likes" color={COLORS.likes} total={data.totals.likes} />
                <DailyBars title="New matches per day" series={data.series} metric="matches" color={COLORS.matches} total={data.totals.matches} />
                <DailyBars title="Messages received per day" series={data.series} metric="messages" color={COLORS.messages} total={data.totals.messages} />
              </div>

              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <HBars
                  title="Where your viewers are"
                  rows={data.topCities.map((c) => ({ label: c.city, count: c.count }))}
                  color={COLORS.views}
                  empty="No viewer cities yet — views from members with a city set show up here."
                />
                <HBars title="Busiest days" rows={data.byWeekday.map((d) => ({ label: d.day, count: d.count }))} color={COLORS.likes} empty="Not enough activity yet." />
                <HBars title="Busiest times (SAST)" rows={data.byHour} color={COLORS.messages} empty="Not enough activity yet." />
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-6">
                <div className="glass rounded-2xl p-5">
                  <p className="text-white/80 text-sm font-medium flex items-center gap-2 mb-2"><Clock size={14} className="text-[#D4AF37]" aria-hidden="true" /> Best time to be online</p>
                  {data.bestDay ? (
                    <p className="text-white text-lg font-serif">
                      {data.bestDay}s {data.bestTime}
                      <span className="block text-white/55 text-xs font-sans mt-1">When your views, likes and messages peak. Being online then (or boosting) gets you seen most.</span>
                    </p>
                  ) : (
                    <p className="text-white/55 text-sm">We&apos;ll spot your best time once a little more activity comes in.</p>
                  )}
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-white/80 text-sm font-medium flex items-center gap-2 mb-2"><Rocket size={14} className="text-[#FF4D6D]" aria-hidden="true" /> Boost</p>
                  {data.boost.active && data.boost.boostedUntil ? (
                    <p className="text-white text-sm">You&apos;re boosted until <span className="font-semibold">{when(data.boost.boostedUntil)}</span>.</p>
                  ) : data.boost.nextAvailableAt ? (
                    <p className="text-white/75 text-sm">Next boost available <span className="text-white font-semibold">{when(data.boost.nextAvailableAt)}</span>.</p>
                  ) : (
                    <p className="text-white/75 text-sm">Your boost is ready. <Link href="/subscription" className="text-[#FF4D6D] hover:underline">Boost now</Link>{data.bestDay ? <> — ideally on a {data.bestDay}</> : null}.</p>
                  )}
                </div>
              </div>

              <details className="glass rounded-2xl p-4 text-sm">
                <summary className="text-white/75 cursor-pointer">View the numbers as a table</summary>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Daily profile activity, last {INSIGHT_DAYS} days</caption>
                    <thead>
                      <tr className="text-white/55">
                        <th scope="col" className="py-1.5 pr-3 font-medium">Date</th>
                        <th scope="col" className="py-1.5 pr-3 font-medium text-right">Views</th>
                        <th scope="col" className="py-1.5 pr-3 font-medium text-right">Likes</th>
                        <th scope="col" className="py-1.5 pr-3 font-medium text-right">Matches</th>
                        <th scope="col" className="py-1.5 font-medium text-right">Messages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.series].reverse().map((d) => (
                        <tr key={d.date} className="border-t border-white/5 text-white/80 tabular-nums">
                          <th scope="row" className="py-1.5 pr-3 font-normal">{d.date}</th>
                          <td className="py-1.5 pr-3 text-right">{d.views}</td>
                          <td className="py-1.5 pr-3 text-right">{d.likes}</td>
                          <td className="py-1.5 pr-3 text-right">{d.matches}</td>
                          <td className="py-1.5 text-right">{d.messages}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="text-white/40 text-[11px] mt-4 flex items-center gap-1.5">
                <MapPin size={10} aria-hidden="true" /> Views from incognito or blocked members aren&apos;t counted. Times are South African time.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
