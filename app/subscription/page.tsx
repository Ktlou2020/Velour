import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Crown, Star, CreditCard, ArrowLeft, Heart, MessageSquareText, MessageCircle, Plane, BarChart3, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import BoostCard from '@/app/profile/BoostCard';
import PlanComparison from '@/components/plans/PlanComparison';
import { getAllowance } from '@/app/api/likes/limits';
import { db } from '@/lib/db';
import { isTravelling } from '@/lib/premium';
import { MEMBERSHIP_PRICES } from '@/lib/payfast';
import { isValidReference } from '@/lib/paystack';
import { verifyAndApply } from '@/lib/paystack-events';
import { paymentProviderLabel } from '@/lib/payments';
import { canManageCard, canResume, currentSubscription, formatDate, GRACE_DAYS, tierLabel } from '@/lib/subscriptions';
import { formatRand } from '@/lib/store/format';
import SubscriptionActions from './SubscriptionActions';

export const dynamic = 'force-dynamic';

const PLAN_META: Record<'FREE' | 'GOLD' | 'PLATINUM', { label: string; price: string; blurb: string }> = {
  FREE: { label: 'Free', price: 'R0 / month', blurb: 'Matching, messaging (unlimited for your first 3 days, then 5 per 24 hours), Daily Spark, forums and events — free for good.' },
  GOLD: { label: 'Gold', price: 'R199 / month', blurb: 'Unlimited messaging and likes, 60-second videos, see who liked and viewed you, search anywhere, travel mode and advanced filters.' },
  PLATINUM: { label: 'Platinum', price: 'R349 / month', blurb: 'Everything in Gold plus spotlight, profile insights, incognito and a weekly boost.' },
};

function resets(iso: string) {
  const d = new Date(iso);
  if (d.getTime() - Date.now() <= 24 * 3600_000) return 'Refreshes at midnight';
  return `Refreshes ${d.toLocaleDateString('en-ZA', { weekday: 'long', timeZone: 'Africa/Johannesburg' })}`;
}

function Meter({ icon: Icon, label, remaining, limit, note, accent }: {
  icon: typeof Heart; label: string; remaining: number | null; limit: number | null; note: string; accent: string;
}) {
  const unlimited = limit === null;
  const none = limit === 0;
  const pct = unlimited ? 100 : none ? 0 : Math.max(0, Math.min(100, ((remaining ?? 0) / limit) * 100));
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-white/60 text-xs flex items-center gap-1.5"><Icon size={12} aria-hidden="true" /> {label}</p>
      <p className="text-white text-2xl font-bold mt-1 tabular-nums">
        {unlimited ? 'Unlimited' : none ? '—' : <>{remaining}<span className="text-white/45 text-sm font-normal"> / {limit}</span></>}
      </p>
      {!unlimited && !none && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={remaining ?? 0}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
        </div>
      )}
      <p className="text-white/45 text-[11px] mt-2">{note}</p>
    </div>
  );
}

type Banner = { tone: 'ok' | 'wait'; text: string };

/** Back from Paystack (?reference=…): confirm with Paystack server-side and activate. */
async function confirmReturn(reference: string | undefined, userId: string): Promise<Banner | null> {
  if (!reference || !isValidReference(reference)) return null;
  const r = await verifyAndApply(reference, userId);
  if (r?.result.kind === 'membership' && (r.result.outcome === 'recorded' || r.result.outcome === 'duplicate')) {
    return { tone: 'ok', text: 'Payment confirmed — your membership is active. Enjoy!' };
  }
  if (r?.tx.status === 'abandoned' || r?.tx.status === 'failed') {
    return { tone: 'wait', text: 'That payment didn’t go through, so nothing was charged. You can try again from the plans page.' };
  }
  return { tone: 'wait', text: 'We’re still confirming your payment. If it went through, your membership will show here within a few minutes.' };
}

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  CANCELLING: { label: 'Cancelled — access until period end', cls: 'bg-white/10 text-white/70 border-white/15' },
  PAST_DUE: { label: 'Payment overdue', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string; ref?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/subscription');
  }
  const userId = session.user.id;
  const sp = await searchParams;
  const banner = await confirmReturn(sp.reference ?? sp.trxref ?? sp.ref, userId);
  const allowance = await getAllowance(userId);
  const tier = allowance.tier;
  const plan = PLAN_META[tier];
  const isPaid = tier !== 'FREE';
  const profile = await db.profile.findUnique({ where: { userId }, select: { travelCity: true, travelUntil: true } });
  const travelling = allowance.features.travelMode && isTravelling(profile);
  const [sub, payments, me] = await Promise.all([
    currentSubscription(userId),
    db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: { id: true, reference: true, kind: true, amountCents: true, tier: true, period: true, provider: true, status: true, orderId: true, createdAt: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  const orderNumbers = new Map(
    (await db.order.findMany({ where: { id: { in: payments.map((p) => p.orderId).filter((x): x is string => !!x) } }, select: { id: true, number: true } }))
      .map((o) => [o.id, o.number]),
  );
  const subForTier = sub && sub.tier === tier ? sub : null;
  const priceLabel = subForTier && (subForTier.tier === 'GOLD' || subForTier.tier === 'PLATINUM')
    ? `${formatRand(Math.round(MEMBERSHIP_PRICES[subForTier.tier][subForTier.period === 'annual' ? 'annual' : 'monthly'] * 100))} / ${subForTier.period === 'annual' ? 'year' : 'month'}`
    : plan.price;
  const endsOn = sub ? formatDate(sub.currentPeriodEnd) : '';
  const lastPayment = payments.find((p) => p.kind === 'MEMBERSHIP');

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-1.5 text-white/55 hover:text-white/80 text-sm mb-8 transition-colors">
          <ArrowLeft size={14} />
          Back to account
        </Link>

        <h1 className="font-serif text-3xl font-bold text-white mb-2">Subscription</h1>
        <p className="text-white/60 text-sm mb-8">Your Unbound plan and what&apos;s left this period.</p>

        {banner && (
          <div role="status" className={`rounded-2xl p-4 mb-6 text-sm flex gap-2 border ${banner.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F5D77A]'}`}>
            {banner.tone === 'ok' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> : <Clock size={16} className="shrink-0 mt-0.5" aria-hidden="true" />}
            {banner.text}
          </div>
        )}

        {/* Current Plan Card */}
        <div className={`glass rounded-2xl p-6 mb-6 border ${
          tier === 'PLATINUM' ? 'border-purple-500/30' : tier === 'GOLD' ? 'border-[#D4AF37]/30' : 'border-white/10'
        }`}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {tier === 'GOLD' && <Crown size={18} className="text-[#D4AF37]" />}
                {tier === 'PLATINUM' && <Star size={18} className="text-purple-400" />}
                {tier === 'FREE' && <CreditCard size={18} className="text-white/50" />}
                <h2 className="text-white font-semibold text-lg">{plan.label} plan</h2>
              </div>
              <p className={`text-sm font-medium ${tier === 'PLATINUM' ? 'text-purple-400' : tier === 'GOLD' ? 'text-[#D4AF37]' : 'text-white/55'}`}>
                {priceLabel}
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
              tier === 'PLATINUM' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              tier === 'GOLD' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' :
              'bg-white/10 text-white/60 border border-white/10'
            }`}>
              Current plan
            </span>
          </div>
          <p className="text-white/70 text-sm mb-5">{plan.blurb}</p>

          <div className="flex flex-wrap gap-3">
            {tier !== 'PLATINUM' && (
              <Link
                href="/upgrade"
                className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                {tier === 'FREE' ? 'See Gold & Platinum' : 'Go Platinum'}
              </Link>
            )}
            {allowance.features.profileInsights && (
              <Link href="/insights" className="glass border border-purple-400/30 text-purple-200 hover:bg-purple-500/10 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                <BarChart3 size={14} /> Profile insights
              </Link>
            )}
          </div>

          {sub && (
            <div className="mt-5 pt-5 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {STATUS_CHIP[sub.status] && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CHIP[sub.status].cls}`}>{STATUS_CHIP[sub.status].label}</span>
                )}
                <span className="text-white/45 text-xs">{tierLabel(sub.tier)} · {sub.period === 'annual' ? 'Annual' : 'Monthly'} · {paymentProviderLabel(sub.provider === 'ADMIN' ? null : sub.provider)}</span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-white/45 text-xs">{sub.cancelAtPeriodEnd ? 'Ends on' : sub.status === 'PAST_DUE' ? 'Was due on' : 'Renews on'}</dt>
                  <dd className="text-white">{endsOn}</dd>
                </div>
                <div>
                  <dt className="text-white/45 text-xs">Last payment</dt>
                  <dd className="text-white">
                    {sub.lastPaymentAt && sub.lastPaymentCents !== null
                      ? <>{formatRand(sub.lastPaymentCents)} on {formatDate(sub.lastPaymentAt)}</>
                      : lastPayment ? <>{formatRand(lastPayment.amountCents)} on {formatDate(lastPayment.createdAt)}</> : '—'}
                  </dd>
                </div>
              </dl>
              {sub.status === 'PAST_DUE' && (
                <p className="mt-3 text-sm text-red-200 flex gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
                  Your last renewal didn&apos;t go through. {canManageCard(sub) ? 'Update your card' : 'Renew from the plans page'} before {formatDate(new Date(sub.currentPeriodEnd.getTime() + GRACE_DAYS * 24 * 3600_000))} to keep your features.
                </p>
              )}
              {sub.cancelAtPeriodEnd && (
                <p className="mt-3 text-white/55 text-sm">
                  {sub.provider === 'PAYSTACK' && !sub.providerPlanCode
                    ? <>This was a one-off payment for the period, so it won&apos;t renew automatically.</>
                    : <>You won&apos;t be charged again.</>}{' '}
                  After {endsOn} your account moves to the Free plan — your profile, matches and messages stay.
                </p>
              )}
              <SubscriptionActions
                canCancel={!sub.cancelAtPeriodEnd}
                canResume={canResume(sub)}
                canUpdateCard={canManageCard(sub) && !sub.cancelAtPeriodEnd}
                endsOn={endsOn}
              />
            </div>
          )}
          {!sub && isPaid && me?.role !== 'ADMIN' && (
            <p className="mt-5 pt-5 border-t border-white/10 text-white/55 text-sm">
              This membership was set up before online billing management. For changes or to cancel, email{' '}
              <a href="mailto:support@unboundza.com" className="text-[#FF4D6D] hover:underline">support@unboundza.com</a>{' '}
              from the address on your account.
            </p>
          )}
        </div>

        {/* Live allowances */}
        <h2 className="text-white font-semibold mb-3">Your allowances</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Meter
            icon={MessageCircle}
            label="Messages left (rolling 24h)"
            remaining={allowance.messages.remaining}
            limit={allowance.messages.limit}
            note={allowance.messages.welcomeUntil
              ? `Unlimited messages until ${new Date(allowance.messages.welcomeUntil).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })} (welcome period), then ${allowance.features.messagesPer24h} per rolling 24 hours`
              : allowance.messages.limit === null
              ? `Message as much as you like · chat videos up to ${allowance.features.chatVideoMaxSec >= 120 ? `${allowance.features.chatVideoMaxSec / 60} min` : `${allowance.features.chatVideoMaxSec} sec`}`
              : allowance.messages.resetsAt && (allowance.messages.remaining ?? 0) < allowance.messages.limit
                ? `Text, photos, videos & voice notes · next one frees up ${new Date(allowance.messages.resetsAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })}`
                : 'Text, photos, videos & voice notes · unlimited with Gold'}
            accent="#7DD3FC"
          />
          <Meter
            icon={Heart}
            label="Likes left today"
            remaining={allowance.likes.remaining}
            limit={allowance.likes.limit}
            note={allowance.likes.limit === null ? 'Like as many people as you like' : resets(allowance.likes.resetsAt)}
            accent="#FF4D6D"
          />
          <Meter
            icon={Star}
            label={`Super likes left ${allowance.superLikes.period === 'day' ? 'today' : 'this week'}`}
            remaining={allowance.superLikes.remaining}
            limit={allowance.superLikes.limit}
            note={`${resets(allowance.superLikes.resetsAt)}${allowance.superLikes.bonus > 0 ? ` · +${allowance.superLikes.bonus} bonus from your streak` : ''}`}
            accent="#D4AF37"
          />
          <Meter
            icon={MessageSquareText}
            label="Priority messages this week"
            remaining={allowance.priorityMessages.remaining}
            limit={allowance.priorityMessages.limit}
            note={allowance.priorityMessages.limit === 0 ? 'Pin a message to the top of their inbox with Gold' : allowance.priorityMessages.limit === null ? 'Send as many as you like' : resets(allowance.priorityMessages.resetsAt)}
            accent="#B794F4"
          />
        </div>

        {travelling && profile?.travelCity && profile.travelUntil && (
          <Link href="/account#travel" className="flex items-center gap-2 glass rounded-2xl p-4 mb-6 text-sky-100 text-sm hover:bg-white/5">
            <Plane size={16} className="text-sky-300" aria-hidden="true" />
            Exploring {profile.travelCity} until {profile.travelUntil.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' })}
            <span className="text-sky-200/60 ml-auto">Change</span>
          </Link>
        )}

        {/* Profile Boost */}
        <BoostCard className="mb-6" />

        {/* Compare */}
        <h2 className="text-white font-semibold mb-3">Compare plans</h2>
        <div className="mb-6">
          <PlanComparison current={tier} highlight="GOLD" />
        </div>

        {/* Billing History */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CreditCard size={16} className="text-[#DC143C]" />
            Payment history
          </h3>
          {payments.length === 0 ? (
            <p className="text-white/60 text-sm leading-relaxed">
              No payments yet. For older invoices or billing queries, contact{' '}
              <a href="mailto:support@unboundza.com" className="text-[#FF4D6D] hover:underline">support@unboundza.com</a>.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {payments.map((p) => {
                const order = p.orderId ? orderNumbers.get(p.orderId) : undefined;
                return (
                  <li key={p.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-white">
                        {p.kind === 'STORE'
                          ? order ? <Link href={`/store/orders/${encodeURIComponent(order)}`} className="hover:underline">Store order {order}</Link> : 'Store order'
                          : `Unbound ${tierLabel(p.tier ?? 'FREE')}${p.period ? ` (${p.period === 'annual' ? 'annual' : 'monthly'})` : ''}`}
                      </p>
                      <p className="text-white/45 text-xs truncate">{formatDate(p.createdAt)} · {paymentProviderLabel(p.provider)} · Ref {p.reference}</p>
                    </div>
                    <p className={`tabular-nums shrink-0 ${p.status === 'REFUNDED' ? 'text-white/45 line-through' : 'text-white'}`}>{formatRand(p.amountCents)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
