'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Crown, Star, Zap, Shield, MessageCircle, Eye, Heart, Calendar, Users, ChevronDown } from 'lucide-react'

const FREE_FEATURES = [
  'Browse up to 20 profiles per day',
  '3 messages per day',
  'Basic search filters',
  'Create singles or couples profile',
  'Community forum access (read only)',
  'See your own matches',
]
const GOLD_FEATURES = [
  'Unlimited profile browsing',
  'Unlimited messaging',
  'Advanced search & filters',
  'See everyone who liked you',
  'Private photo access',
  'Events & meetups access',
  'Profile boost (1× per month)',
  'Read receipts',
  'Couple profile — search for male or female thirds',
  'Priority in search results',
  'Forum posting & replies',
]
const PLATINUM_FEATURES = [
  'Everything in Gold',
  'AI-powered compatibility matching',
  'Dedicated concierge support',
  'Weekly profile boost',
  'Exclusive Platinum-only events',
  'Anonymous / incognito browsing',
  'Advanced compatibility insights',
  'Couple profile — advanced partner search',
  'Video profile (30 sec)',
  'First access to new features',
  'Verified badge',
]

const FAQS = [
  { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription at any time. Your premium access continues until the end of your billing period.' },
  { q: 'Is my payment information secure?', a: 'Absolutely. We use industry-standard SSL encryption and partner with Stripe for secure payment processing. We never store your card details.' },
  { q: 'What happens to my profile if I downgrade?', a: 'Your profile and all messages are preserved. You simply revert to the free tier feature set.' },
  { q: 'Do you offer refunds?', a: 'We offer a 3-day money-back guarantee on new subscriptions if you are not satisfied.' },
  { q: 'Can I upgrade or downgrade mid-cycle?', a: 'Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the next billing cycle.' },
]

export default function UpgradePage() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const goldPrice = annual ? '139' : '199'
  const platinumPrice = annual ? '249' : '349'

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold">V</span>
            </div>
            <span className="text-xl font-serif font-bold text-white">VELOUR</span>
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
            Unlock Your Full<br />
            <span className="text-gradient-crimson">Potential</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Join thousands of members who found extraordinary connections with Velour Premium.
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
              <p className="text-gray-500 text-sm">Freemium — always free, no card needed</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">R0</span>
              <span className="text-gray-500 text-sm">/month</span>
            </div>
            <Link href="/auth/signup" className="block w-full py-3 rounded-xl border border-white/15 text-center text-gray-300 hover:bg-white/5 transition-colors font-medium mb-6">
              Start for Free — No Card Needed
            </Link>
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
                <span className="bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] text-xs font-bold px-4 py-1 rounded-full">MOST POPULAR</span>
              </div>
              <div className="mb-6 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="text-lg font-semibold text-white">Gold</h3>
                </div>
                <p className="text-gray-400 text-sm">The complete experience</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">R{goldPrice}</span>
                <span className="text-gray-400 text-sm">/month</span>
                {annual && <p className="text-green-400 text-xs mt-1">Billed annually — save R720/yr</p>}
              </div>
              <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all mb-6">
                Upgrade to Gold
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
              <p className="text-gray-500 text-sm">For the most discerning members</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">R{platinumPrice}</span>
              <span className="text-gray-500 text-sm">/month</span>
              {annual && <p className="text-green-400 text-xs mt-1">Billed annually — save R1 200/yr</p>}
            </div>
            <button className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold hover:from-purple-500 hover:to-purple-700 transition-all mb-6">
              Upgrade to Platinum
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

        {/* Benefits */}
        <div className="mb-16">
          <h2 className="text-2xl font-serif font-bold text-white text-center mb-8">Why Velour Premium?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: MessageCircle, title: 'Unlimited Messaging', desc: 'Connect with anyone, anytime' },
              { icon: Eye, title: 'See Who Views You', desc: 'Know who is interested' },
              { icon: Zap, title: 'Boosted Visibility', desc: 'Get seen by more members' },
              { icon: Shield, title: 'Verified & Safe', desc: 'Premium safety features' },
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
          <h2 className="text-2xl font-serif font-bold text-white mb-3">Ready to meet someone extraordinary?</h2>
          <p className="text-gray-400 mb-6">Join 52,000+ members who have already found their connection.</p>
          <Link href="/auth/signup" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-[#DC143C]/20">
            Start Free Today <Heart className="w-4 h-4" />
          </Link>
          <p className="text-gray-600 text-xs mt-4">No credit card required for free tier · Cancel anytime</p>
        </div>
      </div>
    </div>
  )
}
