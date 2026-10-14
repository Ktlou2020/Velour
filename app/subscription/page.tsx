import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Crown, Star, CreditCard, ArrowLeft, Mail, Heart, MessageSquareText, MessageCircle, Plane, BarChart3 } from 'lucide-react';
import BoostCard from '@/app/profile/BoostCard';
import PlanComparison from '@/components/plans/PlanComparison';
import { getAllowance } from '@/app/api/likes/limits';
import { db } from '@/lib/db';
import { isTravelling } from '@/lib/premium';

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

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/subscription');
  }
  const userId = session.user.id;
  const allowance = await getAllowance(userId);
  const tier = allowance.tier;
  const plan = PLAN_META[tier];
  const isPaid = tier !== 'FREE';
  const profile = await db.profile.findUnique({ where: { userId }, select: { travelCity: true, travelUntil: true } });
  const travelling = allowance.features.travelMode && isTravelling(profile);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-1.5 text-white/55 hover:text-white/80 text-sm mb-8 transition-colors">
          <ArrowLeft size={14} />
          Back to account
        </Link>

        <h1 className="font-serif text-3xl font-bold text-white mb-2">Subscription</h1>
        <p className="text-white/60 text-sm mb-8">Your Hush plan and what&apos;s left this period.</p>

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
                {plan.price}
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
            {isPaid && (
              <a
                href="mailto:support@hush.dating?subject=Cancel%20Subscription"
                className="glass border border-white/20 hover:border-red-500/30 hover:text-red-400 text-white/60 px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                <Mail size={14} />
                Cancel subscription
              </a>
            )}
          </div>
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
            Billing history
          </h3>
          <p className="text-white/60 text-sm leading-relaxed">
            Billing history is available via PayFast — contact{' '}
            <a href="mailto:support@hush.dating" className="text-[#FF4D6D] hover:underline">support@hush.dating</a>{' '}
            for invoices or billing queries.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
