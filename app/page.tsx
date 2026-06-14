import { Suspense } from 'react';
import Link from 'next/link';
import {
  Heart, MessageCircle, Calendar, Shield, Image, Crown,
  Star, ChevronDown, Users, Globe, ThumbsUp, Check, ArrowRight, MapPin,
} from 'lucide-react';
import LandingNav from './LandingNav';
import MemberShowcase from './MemberShowcase';

const FEATURES = [
  { icon: Heart, title: 'Advanced Matching', desc: 'AI-powered compatibility scoring analyses hundreds of dimensions to find your perfect connections.', color: 'text-[#DC143C]' },
  { icon: MessageCircle, title: 'Private Messaging', desc: 'End-to-end encrypted conversations. Your privacy is paramount — always.', color: 'text-blue-400' },
  { icon: Calendar, title: 'Community Events', desc: 'Exclusive member-only gatherings, soirées, and travel experiences in cities worldwide.', color: 'text-[#D4AF37]' },
  { icon: Shield, title: 'Verified Profiles', desc: 'Multi-step ID verification ensures every member is genuine, safe, and who they claim to be.', color: 'text-emerald-400' },
  { icon: Image, title: 'Photo Galleries', desc: 'Private and public photo albums with granular access controls you manage entirely.', color: 'text-purple-400' },
  { icon: Crown, title: 'Premium Concierge', desc: 'Dedicated support team available 24/7 for our Platinum members. Real humans, real care.', color: 'text-[#D4AF37]' },
];

const STEPS = [
  { num: '01', icon: Users, title: 'Create Your Profile', desc: 'Share your story, passions, and desires. Our guided profile builder helps you stand out authentically.' },
  { num: '02', icon: Heart, title: 'Discover Connections', desc: 'Browse curated matches, swipe through Discover, or explore the community at your own pace.' },
  { num: '03', icon: MapPin, title: 'Meet in Real Life', desc: 'Take conversations from the app to unforgettable real-world experiences, guided by our events team.' },
];

const TESTIMONIALS = [
  { text: 'The most elegant and respectful dating community I\'ve ever been part of. Velour genuinely stands apart in every way.', author: 'Sofia M.', location: 'London', stars: 5 },
  { text: 'Velour connected me with someone truly compatible. The matching algorithm is exceptional — it understood what I really wanted.', author: 'James K.', location: 'New York', stars: 5 },
  { text: 'As a professional, I needed discretion and quality. Velour delivers both flawlessly. I found my partner here last year.', author: 'Anonymous', location: 'Paris', stars: 5 },
];

const TIERS = [
  {
    name: 'Freemium', price: 'R0', period: 'always free',
    features: ['Browse up to 20 profiles per day', '3 messages per day', 'Create singles or couples profile', 'Basic search filters', 'Community forum access (read only)'],
    cta: 'Start Free — No Card', popular: false,
  },
  {
    name: 'Gold', price: 'R199', period: 'per month',
    features: ['Unlimited messaging & browsing', 'Advanced search & filters', 'See everyone who liked you', 'Private photo access', 'Events & meetups access', 'Profile boost (1× per month)', 'Couple profile features'],
    cta: 'Go Gold', popular: true,
  },
  {
    name: 'Platinum', price: 'R349', period: 'per month',
    features: ['Everything in Gold', 'AI-powered compatibility matching', 'Weekly profile boost', 'Couple profile — advanced partner search', 'Exclusive Platinum-only events', 'Concierge support + verified badge', 'Incognito browsing'],
    cta: 'Go Platinum', popular: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <LandingNav />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden animated-gradient pt-16">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#DC143C]/10 rounded-full blur-3xl float-animation pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl float-animation-delayed pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl float-animation-slow pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-white/60 mb-8">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>52,000+ members online worldwide</span>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-tight mb-6">
            Where Connections<br />
            Become{' '}
            <span className="text-gradient-crimson">Extraordinary</span>
          </h1>

          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            The world&apos;s most refined lifestyle dating community. Discover genuine connections with extraordinary people who share your passions, values, and desires.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/signup" className="btn-crimson px-8 py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 glow-crimson">
              Join Free Today <ArrowRight size={20} />
            </Link>
            <Link href="/members" className="glass border border-white/20 hover:border-white/40 px-8 py-4 rounded-xl text-lg font-medium text-white transition-all flex items-center justify-center gap-2">
              Browse Members
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {[
              { icon: Users, label: '52,000+ Members', sub: 'Active community' },
              { icon: Globe, label: '120+ Countries', sub: 'Global reach' },
              { icon: ThumbsUp, label: '98% Satisfaction', sub: 'Member rated' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="glass px-6 py-4 rounded-xl flex items-center gap-3 float-animation">
                <Icon className="text-[#DC143C]" size={20} />
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">{label}</div>
                  <div className="text-white/40 text-xs">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 animate-bounce">
          <ChevronDown size={24} />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 bg-[#0A0A0F]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#DC143C] text-sm font-semibold tracking-widest uppercase mb-3">Simple & Effortless</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Crafted for Extraordinary People</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">Three steps to the connection you&apos;ve been searching for.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ num, icon: Icon, title, desc }) => (
              <div key={num} className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
                <div className="absolute top-4 right-4 text-6xl font-bold text-white/5 font-serif">{num}</div>
                <div className="w-14 h-14 bg-[#DC143C]/10 border border-[#DC143C]/20 rounded-xl flex items-center justify-center mb-6">
                  <Icon className="text-[#DC143C]" size={24} />
                </div>
                <h3 className="text-white font-bold text-xl mb-3 font-serif">{title}</h3>
                <p className="text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 bg-gradient-to-b from-[#0A0A0F] to-[#0F0A1E]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Everything You Need</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Premium Features</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">Built with care, refined for luxury, designed around your needs.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="glass rounded-2xl p-6 card-hover group">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Icon className={color} size={22} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real Member Showcase — server component with real DB data */}
      <Suspense fallback={
        <section className="py-24 px-4 bg-[#0F0A1E]">
          <div className="max-w-6xl mx-auto text-center">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-36 bg-white/5" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-white/5 rounded w-3/4" />
                    <div className="h-2 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      }>
        <MemberShowcase />
      </Suspense>

      {/* Testimonials */}
      <section className="py-24 px-4 bg-[#0A0A0F]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Member Stories</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Real Connections, Real Stories</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="glass rounded-2xl p-8 card-hover">
                <div className="flex mb-4">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} size={16} className="text-[#D4AF37] fill-[#D4AF37]" />
                  ))}
                </div>
                <p className="text-white/80 leading-relaxed mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DC143C]/20 border border-[#DC143C]/30 flex items-center justify-center text-[#DC143C] font-bold text-sm">
                    {t.author[0]}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{t.author}</div>
                    <div className="text-white/40 text-xs">{t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section id="pricing" className="py-24 px-4 bg-gradient-to-b from-[#0A0A0F] to-[#0F0A1E]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#DC143C] text-sm font-semibold tracking-widest uppercase mb-3">Choose Your Journey</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Membership Tiers</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">Start free, upgrade when you&apos;re ready for the full Velour experience.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`glass rounded-2xl p-8 border relative card-hover ${tier.popular ? 'border-[#D4AF37]/40 shadow-lg shadow-[#D4AF37]/10' : 'border-white/10'}`}>
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={`font-serif text-2xl font-bold mb-1 ${tier.popular ? 'text-[#D4AF37]' : 'text-white'}`}>{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{tier.price}</span>
                    <span className="text-white/40 text-sm">/{tier.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-white/70 text-sm">
                      <Check size={16} className={`mt-0.5 flex-shrink-0 ${tier.popular ? 'text-[#D4AF37]' : 'text-[#DC143C]'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  className={`block text-center py-3 rounded-xl font-semibold transition-all ${
                    tier.popular
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] hover:from-[#F4D03F] hover:to-[#D4AF37]'
                      : tier.name === 'Platinum'
                      ? 'bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white hover:from-[#FF1744] hover:to-[#DC143C]'
                      : 'glass border border-white/20 hover:border-white/40 text-white'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden p-12 text-center" style={{ background: 'linear-gradient(135deg, #DC143C 0%, #9D0208 50%, #6A040F 100%)' }}>
            <div className="absolute inset-0 shimmer pointer-events-none" />
            <div className="absolute top-4 right-8 text-white/10 font-serif text-9xl font-bold select-none">V</div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4 relative z-10">
              Ready to Meet Someone Extraordinary?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto relative z-10">
              Join over 52,000 members who&apos;ve found genuine connections through Velour. Your story starts today.
            </p>
            <Link href="/auth/signup" className="relative z-10 inline-flex items-center gap-2 bg-white text-[#DC143C] font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-all text-lg">
              Join Velour Free <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#060609] border-t border-white/5 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
                  <span className="text-white font-bold text-lg font-serif">V</span>
                </div>
                <span className="text-white font-bold text-xl tracking-widest font-serif">VELOUR</span>
              </Link>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                Where Connections Become Extraordinary. The world&apos;s most refined lifestyle dating community for discerning adults.
              </p>
              <div className="flex gap-3 mt-6">
                {['T', 'In', 'F'].map((s) => (
                  <div key={s} className="w-9 h-9 glass rounded-lg flex items-center justify-center text-white/40 text-xs font-bold">
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Company</h4>
              <ul className="space-y-2">
                {['About', 'Blog', 'Careers', 'Press', 'Contact'].map((l) => (
                  <li key={l}><Link href="#" className="text-white/40 hover:text-white text-sm transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Legal</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Cookie Policy', href: '#' },
                  { label: 'Safety Center', href: '#' },
                  { label: 'DMCA', href: '#' },
                ].map(({ label, href }) => (
                  <li key={label}><Link href={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-sm">© 2025 Velour. All rights reserved. 18+ only.</p>
            <p className="text-white/20 text-xs">This site is intended for adults aged 18 and over. By using this site you agree to our Terms of Service.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
