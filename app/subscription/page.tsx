import { auth } from '@/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Crown, Star, CreditCard, ArrowLeft, Mail } from 'lucide-react';

const PLAN_FEATURES: Record<string, { label: string; features: string[]; price: string }> = {
  FREE: {
    label: 'Free',
    features: [
      'Browse member profiles',
      'Send up to 5 messages/day',
      'Basic search filters',
      'Upload up to 3 photos',
    ],
    price: 'R0 / month',
  },
  GOLD: {
    label: 'Gold',
    features: [
      'Unlimited messaging',
      'See who liked you',
      'Advanced search filters',
      'Upload up to 9 photos',
      'Priority profile placement',
      'Read receipts',
    ],
    price: 'R199 / month',
  },
  PLATINUM: {
    label: 'Platinum',
    features: [
      'Everything in Gold',
      'Profile boost (3× per week)',
      'See who viewed you',
      'Incognito browsing mode',
      'Verified badge on profile',
      'Dedicated support',
    ],
    price: 'R349 / month',
  },
};

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/subscription');
  }

  const userId = (session.user as { id?: string }).id;
  let tier: 'FREE' | 'GOLD' | 'PLATINUM' = 'FREE';

  if (userId) {
    try {
      const profile = await db.profile.findUnique({
        where: { userId },
        select: { membershipTier: true },
      });
      if (profile?.membershipTier) {
        tier = profile.membershipTier as 'FREE' | 'GOLD' | 'PLATINUM';
      }
    } catch { /* ignore */ }
  }

  const plan = PLAN_FEATURES[tier] ?? PLAN_FEATURES.FREE;
  const isPaid = tier === 'GOLD' || tier === 'PLATINUM';

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        {/* Back link */}
        <Link href="/profile" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors">
          <ArrowLeft size={14} />
          Back to Profile
        </Link>

        <h1 className="font-serif text-3xl font-bold text-white mb-2">Subscription</h1>
        <p className="text-white/50 text-sm mb-10">Manage your Velour membership</p>

        {/* Current Plan Card */}
        <div className={`glass rounded-2xl p-6 mb-6 border ${
          tier === 'PLATINUM' ? 'border-purple-500/30' :
          tier === 'GOLD' ? 'border-[#D4AF37]/30' :
          'border-white/10'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {tier === 'GOLD' && <Crown size={18} className="text-[#D4AF37]" />}
                {tier === 'PLATINUM' && <Star size={18} className="text-purple-400" />}
                {tier === 'FREE' && <CreditCard size={18} className="text-white/40" />}
                <h2 className="text-white font-semibold text-lg">{plan.label} Plan</h2>
              </div>
              <p className={`text-sm font-medium ${
                tier === 'PLATINUM' ? 'text-purple-400' :
                tier === 'GOLD' ? 'text-[#D4AF37]' :
                'text-white/40'
              }`}>
                {plan.price}
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              tier === 'PLATINUM' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              tier === 'GOLD' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' :
              'bg-white/10 text-white/50 border border-white/10'
            }`}>
              Current Plan
            </span>
          </div>

          <ul className="space-y-2 mb-6">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-white/70">
                <div className="w-4 h-4 rounded-full bg-[#DC143C]/20 flex items-center justify-center flex-shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="#DC143C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            {tier !== 'PLATINUM' && (
              <Link
                href="/upgrade"
                className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                {tier === 'FREE' ? 'Upgrade Plan' : 'Go Platinum'}
              </Link>
            )}
            {isPaid && (
              <a
                href="mailto:support@velour.dating?subject=Cancel%20Subscription"
                className="glass border border-white/20 hover:border-red-500/30 hover:text-red-400 text-white/50 px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                <Mail size={14} />
                Cancel Subscription
              </a>
            )}
          </div>
        </div>

        {/* Billing History */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CreditCard size={16} className="text-[#DC143C]" />
            Billing History
          </h3>
          <p className="text-white/50 text-sm leading-relaxed">
            Billing history is available via PayFast — contact{' '}
            <a
              href="mailto:support@velour.dating"
              className="text-[#DC143C] hover:underline"
            >
              support@velour.dating
            </a>{' '}
            for invoices or billing queries.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
