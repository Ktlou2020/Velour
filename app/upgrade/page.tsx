'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Crown, Star, Plane, Eye, Heart, ChevronDown, Loader2, MessageCircle } from 'lucide-react'
import { NEW_MEMBER_UNLIMITED_MESSAGES_DAYS, PLANS, type PlanTier } from '@/lib/plans'
import PlanComparison from '@/components/plans/PlanComparison'

// Card highlights only — the full, enforced list is the comparison table below
// (rendered from lib/plans.ts PLAN_FEATURES).
const FREE_FEATURES = [
  `${PLANS.FREE.likesPerDay} likes a day + ${PLANS.FREE.superLikes} super like a day`,
  `Messages: unlimited for your first ${NEW_MEMBER_UNLIMITED_MESSAGES_DAYS} days, then ${PLANS.FREE.messagesPer24h} per 24 hours`,
  'Reactions, chat games & icebreakers',
  `Search up to ${PLANS.FREE.maxSearchRadiusKm} km from you`,
  `${PLANS.FREE.dailyPicks} hand-picked matches every day`,
  'Daily Spark, status & profile badges',
  'Post in forums, RSVP to events',
  `${PLANS.FREE.privateAlbums} private photo album`,
  'Singles & couples profiles, safety centre',
]
const GOLD_FEATURES = [
  'Unlimited messaging',
  `${PLANS.GOLD.chatVideoMaxSec}-second videos in chat`,
  'Unlimited likes',
  `${PLANS.GOLD.superLikes} super likes a week`,
  'See who liked you & who viewed you',
  'Search anywhere & travel mode',
  'Advanced filters & undo your last swipe',
  `Read receipts & ${PLANS.GOLD.priorityMessagesPerWeek} priority messages a week`,
  `${PLANS.GOLD.dailyPicks} daily picks, monthly boost, priority in search`,
  'Unlimited private albums & host events',
]
const PLATINUM_FEATURES = [
  'Everything in Gold',
  `${PLANS.PLATINUM.superLikes} super likes a week & unlimited priority messages`,
  `${PLANS.PLATINUM.dailyPicks} daily picks & a weekly boost`,
  'Spotlight at the top of discover',
  'Profile insights dashboard',
  'Incognito browsing & compatibility insights',
  'Video profile',
]

const FAQS = [
  { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription at any time. Your premium access continues until the end of your billing period.' },
  { q: 'Is my payment information secure?', a: 'Absolutely. We use industry-standard SSL encryption and partner with PayFast for secure payment processing. We never store your card details.' },
  { q: 'What happens to my profile if I downgrade?', a: 'Your profile and all messages are preserved. You simply revert to the free tier feature set.' },
  { q: 'Do you offer refunds?', a: 'If you are unhappy with your subscription, contact support@hush.dating and our team will review your request.' },
  { q: 'Can I upgrade or downgrade mid-cycle?', a: 'Yes. Upgrades take effect as soon as payment is confirmed. For downgrades or billing changes, contact support@hush.dating.' },
]

type Tier = 'GOLD' | 'PLATINUM'

export default function UpgradePage() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null)
  const [current, setCurrent] = useState<PlanTier | null>(null)

  useEffect(() => {
    fetch('/api/likes/allowance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { tier?: PlanTier } | null) => { if (d?.tier) setCurrent(d.tier) })
      .catch(() => {})
  }, [])

  const goldPrice = annual ? '139' : '199'
  const platinumPrice = annual ? '249' : '349'

  async function handleUpgrade(tier: Tier) {
    setLoadingTier(tier)
    try {
      const res = await fetch('/api/payment/payfast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing: annual ? 'annual' : 'monthly' }),
      })

      if (!res.ok) throw new Error('Payment initiation failed')

      const data = await res.json() as { paymentData: Record<string, string>; payfastUrl: string }

      // PayFast requires a form submission to their endpoint
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.payfastUrl

      Object.entries(data.paymentData).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })

      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      console.error('Payment error:', err)
      setLoadingTier(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold">H</span>
            </div>
            <span className="text-xl font-serif font-bold text-white">HUSH</span>
          </Link>
          <Link href="/members" className="text-gray-400 hover:text-white text-sm transition-colors">Back to Members</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5 mb-6">
            <Crown className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-[#D4AF37] text-sm font-medium">Premium Membership</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-4">
            Free is generous.<br />
            <span className="text-gradient-crimson">Gold is effortless.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Everyone can match, chat and join the community for free. Upgrade for unlimited messaging and likes, to see who&apos;s already interested, and to search anywhere.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 mt-8 glass rounded-full p-1.5">
            <button onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!annual ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>
              Annual
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">Save 30%</span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Free */}
          <div className="glass rounded-2xl p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-1">Free</h3>
              <p className="text-gray-500 text-sm">Always free, no card needed</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">R0</span>
              <span className="text-gray-500 text-sm">/month</span>
            </div>
            {current === 'FREE' || current === null ? (
              <div className="block w-full py-3 rounded-xl border border-white/15 text-center text-gray-300 font-medium mb-6" aria-live="polite">
                {current === 'FREE' ? 'Your current plan' : 'Included with every account'}
              </div>
            ) : (
              <div className="block w-full py-3 rounded-xl border border-white/10 text-center text-gray-500 font-medium mb-6">Always included</div>
            )}
            <ul className="space-y-3">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                  <Check className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Gold */}
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-b from-[#D4AF37] to-[#B8960C]" style={{boxShadow: '0 0 30px rgba(212,175,55,0.2)'}}>
            <div className="bg-[#12121A] rounded-2xl p-6 h-full">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] text-xs font-bold px-4 py-1 rounded-full">RECOMMENDED</span>
              </div>
              <div className="mb-6 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="text-lg font-semibold text-white">Gold</h3>
                </div>
                <p className="text-gray-400 text-sm">The complete experience{current === 'GOLD' ? ' · your plan' : ''}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">R{goldPrice}</span>
                <span className="text-gray-400 text-sm">/month</span>
                {annual && <p className="text-green-400 text-xs mt-1">Billed annually — save R720/yr</p>}
              </div>
              <button
                onClick={() => handleUpgrade('GOLD')}
                disabled={loadingTier !== null}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all mb-6 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loadingTier === 'GOLD' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
                ) : (
                  'Upgrade to Gold'
                )}
              </button>
              <ul className="space-y-3">
                {GOLD_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Platinum */}
          <div className="glass rounded-2xl p-6 border border-purple-500/20">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Platinum</h3>
              </div>
              <p className="text-gray-500 text-sm">Be seen first, know what works{current === 'PLATINUM' ? ' · your plan' : ''}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">R{platinumPrice}</span>
              <span className="text-gray-500 text-sm">/month</span>
              {annual && <p className="text-green-400 text-xs mt-1">Billed annually — save R1 200/yr</p>}
            </div>
            <button
              onClick={() => handleUpgrade('PLATINUM')}
              disabled={loadingTier !== null}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold hover:from-purple-500 hover:to-purple-700 transition-all mb-6 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loadingTier === 'PLATINUM' ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
              ) : (
                'Upgrade to Platinum'
              )}
            </button>
            <ul className="space-y-3">
              {PLATINUM_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Comparison */}
        <div id="compare" className="mb-16 scroll-mt-24">
          <h2 className="text-2xl font-serif font-bold text-white text-center mb-2">Compare plans</h2>
          <p className="text-gray-400 text-sm text-center mb-8">Exactly what each plan includes — this is the same list the app uses to unlock features.</p>
          <PlanComparison current={current} highlight="GOLD" />
        </div>

        {/* Benefits */}
        <div className="mb-16">
          <h2 className="text-2xl font-serif font-bold text-white text-center mb-8">Why members upgrade</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: MessageCircle, title: 'Unlimited messaging', desc: 'Plus 60-second videos in chat' },
              { icon: Heart, title: 'See who liked you', desc: 'Like them back for an instant match' },
              { icon: Eye, title: 'See who viewed you', desc: 'Know who is curious about you' },
              { icon: Plane, title: 'Travel mode', desc: 'Meet people before you land' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass rounded-xl p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#DC143C]/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-[#DC143C]" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
                <p className="text-gray-500 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left">
                  <span className="text-white font-medium text-sm">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center glass-crimson rounded-2xl p-10">
          <h2 className="text-2xl font-serif font-bold text-white mb-3">Not ready yet? That&apos;s fine.</h2>
          <p className="text-gray-400 mb-6">Free never expires. Keep discovering — your likes refresh every midnight, and your first 3 days of messaging are unlimited.</p>
          <Link href="/discover" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-[#DC143C]/20">
            Keep discovering <Heart className="w-4 h-4" />
          </Link>
          <p className="text-gray-500 text-xs mt-4">Secure payments by PayFast · Cancel anytime</p>
        </div>
      </div>
    </div>
  )
}
