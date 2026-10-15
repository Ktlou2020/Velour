import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/auth';
import { ANALYTICS_RANGES, getAdminAnalytics, parseRange } from '@/lib/admin-analytics';
import { STORE_NAME } from '@/lib/store/config';
import { DailyBars, Funnel, HBars, Kpi, rands } from './charts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics — Unbound admin' };

const RANGE_LABEL: Record<number, string> = { 7: '7 days', 30: '30 days', 90: '90 days', 365: '12 months' };

function pct(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-white text-lg font-serif font-bold">{title}</h2>
      {note && <p className="text-white/45 text-xs mt-0.5">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/members');

  const days = parseRange((await searchParams).days);
  const a = await getAdminAnalytics(days);
  const { totals: t, prevTotals: p, members: m } = a;

  return (
    <div className="p-4 sm:p-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-bold font-serif">Analytics</h1>
          <p className="text-white/50 text-sm mt-1">
            Last {RANGE_LABEL[days]} (since {new Date(`${a.from}T12:00:00+02:00`).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}), compared with the {RANGE_LABEL[days]} before. Admin accounts are excluded from member counts.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <nav aria-label="Date range" className="flex rounded-xl bg-white/5 p-1">
            {ANALYTICS_RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin/analytics?days=${r}`}
                aria-current={r === days ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${r === days ? 'bg-[#DC143C] text-white' : 'text-white/60 hover:text-white'}`}
              >
                {RANGE_LABEL[r]}
              </Link>
            ))}
          </nav>
          <a
            href={`/api/admin/analytics?days=${days}&format=csv`}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1.5"
          >
            <Download size={13} aria-hidden="true" /> Export CSV
          </a>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
        <Kpi label="New members" value={t.signups} previous={p.signups} />
        <Kpi label="Messages sent" value={t.messages} previous={p.messages} />
        <Kpi label="Matches" value={t.matches} previous={p.matches} />
        <Kpi label="Profile views" value={t.profileViews} previous={p.profileViews} />
        <Kpi label="Revenue" value={a.revenue.totalCents} previous={a.revenue.prevTotalCents} money />
        <Kpi label="Reports" value={t.reports} previous={p.reports} />
      </div>

      <Section title="Members">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <Kpi label="Total members" value={m.total} />
          <Kpi label="Online now" value={m.onlineNow} />
          <Kpi label="Active today" value={m.dau} />
          <Kpi label="Active this week" value={m.wau} />
          <Kpi label="Active this month" value={m.mau} />
          <Kpi label="Couples" value={m.couples} />
          <Kpi label="Photo-verified" value={m.photoVerified} />
          <Kpi label="Banned" value={m.banned} />
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <div className="glass rounded-2xl p-4 text-sm space-y-1.5">
            <p className="text-white/80 font-medium">Health</p>
            <p className="text-white/60">Stickiness (daily ÷ monthly active): <span className="text-white">{m.stickiness}%</span></p>
            <p className="text-white/60">Email verified: <span className="text-white">{pct(m.emailVerified, m.total)}</span></p>
            <p className="text-white/60">Photo-verified: <span className="text-white">{pct(m.photoVerified, m.total)}</span></p>
            <p className="text-white/60">Admins: <span className="text-white">{m.admins}</span></p>
          </div>
          <div className="glass rounded-2xl p-4 text-sm space-y-1.5">
            <p className="text-white/80 font-medium">Retention (joined this period)</p>
            <p className="text-white/60">
              Came back after day 1: <span className="text-white">{pct(a.retention.day1.returned, a.retention.day1.cohort)}</span>
              <span className="text-white/40"> ({a.retention.day1.returned}/{a.retention.day1.cohort})</span>
            </p>
            <p className="text-white/60">
              Came back after day 7: <span className="text-white">{pct(a.retention.day7.returned, a.retention.day7.cohort)}</span>
              <span className="text-white/40"> ({a.retention.day7.returned}/{a.retention.day7.cohort})</span>
            </p>
            <p className="text-white/40 text-[11px]">Based on each member&apos;s last visit, so it is a lower bound.</p>
          </div>
          <HBars title="Singles and couples" rows={a.breakdowns.accountType} color="#DC143C" empty="No members yet" showShare />
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
          <HBars title="Gender" rows={a.breakdowns.gender} color="#DC143C" empty="No data yet" showShare />
          <HBars title="Age" rows={a.breakdowns.age} color="#D4AF37" empty="No data yet" showShare />
          <HBars title="Orientation" rows={a.breakdowns.orientation} color="#a78bfa" empty="No data yet" showShare />
          <HBars title="Top cities" rows={a.breakdowns.cities} color="#34d399" empty="No cities set yet" />
        </div>
      </Section>

      <Section title="Growth and engagement">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          <DailyBars title="New sign-ups" series={a.series} metric="signups" color="#DC143C" />
          <DailyBars title="Members who messaged" series={a.series} metric="activeChatters" color="#D4AF37" />
          <DailyBars title="Messages sent" series={a.series} metric="messages" color="#a78bfa" />
          <DailyBars title="Matches" series={a.series} metric="matches" color="#f472b6" />
          <DailyBars title="Likes" series={a.series} metric="likes" color="#fb7185" />
          <DailyBars title="Profile views" series={a.series} metric="profileViews" color="#60a5fa" />
          <DailyBars title="Explore photo likes" series={a.series} metric="photoLikes" color="#34d399" />
          <DailyBars title="Spark answers" series={a.series} metric="sparkAnswers" color="#fbbf24" />
          <DailyBars title="Reviews" series={a.series} metric="reviews" color="#2dd4bf" />
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <Funnel steps={a.funnel} />
          <figure className="glass rounded-2xl p-4 sm:p-5">
            <figcaption className="text-white/80 text-sm font-medium mb-3">Most-viewed profiles</figcaption>
            {a.engagement.topViewed.length === 0 ? (
              <p className="text-white/50 text-sm">No profile views in this period</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {a.engagement.topViewed.map((u, i) => (
                  <li key={u.username} className="flex justify-between gap-3">
                    <Link href={`/members/${u.username}`} className="text-white/80 hover:text-white truncate">
                      <span className="text-white/40 tabular-nums mr-2">{i + 1}.</span>{u.name}
                    </Link>
                    <span className="text-white tabular-nums">{u.views.toLocaleString('en-ZA')} views</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-white/45 text-[11px] mt-4">
              {a.engagement.chatters.toLocaleString('en-ZA')} members sent messages in this period, {a.engagement.messagesPerChatter} each on average.
            </p>
          </figure>
        </div>
      </Section>

      <Section title="Revenue" note="Membership revenue uses the amount PayFast confirmed; older payments without an amount are estimated from the plan price.">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi label="Membership revenue" value={a.revenue.membershipCents} previous={p.membershipRevenueCents} money />
          <Kpi label="Membership payments" value={t.memberships} previous={p.memberships} />
          <Kpi label={`${STORE_NAME} revenue`} value={a.revenue.storeCents} previous={p.storeRevenueCents} money />
          <Kpi label="Paid store orders" value={t.storeOrders} previous={p.storeOrders} />
          <Kpi label="Paying members" value={a.revenue.payingMembers} />
          <div className="glass rounded-2xl p-4">
            <p className="text-white/60 text-xs">Paid conversion</p>
            <p className="text-white text-2xl font-bold tabular-nums mt-1">{a.revenue.conversionPct}%</p>
            <p className="text-[11px] mt-1 text-white/45">Avg order {a.revenue.avgOrderCents ? rands(a.revenue.avgOrderCents) : '—'}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
          <DailyBars title="Membership revenue" series={a.series} metric="membershipRevenueCents" color="#D4AF37" money />
          <DailyBars title={`${STORE_NAME} revenue`} series={a.series} metric="storeRevenueCents" color="#DC143C" money />
          <HBars title="Membership tiers" rows={a.breakdowns.tiers} color="#D4AF37" empty="No members yet" showShare />
          <figure className="glass rounded-2xl p-4 sm:p-5">
            <figcaption className="text-white/80 text-sm font-medium mb-3">Top {STORE_NAME} products</figcaption>
            {a.revenue.topProducts.length === 0 ? (
              <p className="text-white/50 text-sm">No paid orders in this period</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {a.revenue.topProducts.map((pr) => (
                  <li key={pr.name} className="flex justify-between gap-3">
                    <span className="text-white/80 truncate">{pr.name}</span>
                    <span className="text-white tabular-nums">{pr.units} sold</span>
                  </li>
                ))}
              </ol>
            )}
            {a.revenue.pendingOrders > 0 && (
              <p className="text-white/45 text-[11px] mt-4">
                {a.revenue.pendingOrders} order{a.revenue.pendingOrders === 1 ? '' : 's'} awaiting payment. <Link className="underline hover:text-white" href="/admin/store/orders">View orders</Link>
              </p>
            )}
          </figure>
        </div>
      </Section>

      <Section title="Trust and safety">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Reports" value={t.reports} previous={p.reports} />
          <Kpi label="Blocks" value={t.blocks} previous={p.blocks} />
          <Kpi label="Unread reports" value={a.safety.unreadReports} />
          <Kpi label="Verifications pending" value={a.safety.pendingVerification} />
          <Kpi label="Hidden reviews" value={a.safety.hiddenReviews} />
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <DailyBars title="Reports" series={a.series} metric="reports" color="#f87171" />
          <DailyBars title="Blocks" series={a.series} metric="blocks" color="#94a3b8" />
        </div>
        {a.safety.unreadReports > 0 && (
          <p className="text-white/60 text-sm mt-3">
            <Link href="/admin/reports" className="text-[#ff6b81] underline">Review {a.safety.unreadReports} unread report{a.safety.unreadReports === 1 ? '' : 's'}</Link>
          </p>
        )}
      </Section>

      <p className="text-white/30 text-[11px] mt-10">
        Generated {new Date(a.generatedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST. Sensitive details such as ethnicity are never included in analytics.
      </p>
    </div>
  );
}
