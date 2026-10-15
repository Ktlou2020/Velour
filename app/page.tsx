import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, CalendarHeart, Check, ChevronDown, EyeOff, Flag, Heart,
  ImageOff, MessageCircle, MoonStar, ShieldCheck, Sparkles, Star, UserPlus, Users,
} from 'lucide-react';
import LandingNav from './LandingNav';
import MemberShowcase from './MemberShowcase';
import Footer from '@/components/Footer';
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from './site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

const TRUST = [
  { icon: BadgeCheck, label: 'Photo-verified profiles' },
  { icon: EyeOff, label: 'Incognito browsing' },
  { icon: ImageOff, label: 'Blurred photos in chat' },
  { icon: Users, label: 'Singles & couples' },
];

const STEPS = [
  {
    num: '01', icon: UserPlus, title: 'Create your profile',
    desc: 'As a single or as a couple. Add photos, a few prompts and what you’re looking for — share as much or as little as you like.',
  },
  {
    num: '02', icon: Heart, title: 'Discover with intention',
    desc: 'Browse members near you or swipe through Discover. Every profile shows a compatibility score and the reasons behind it.',
  },
  {
    num: '03', icon: CalendarHeart, title: 'Meet, safely',
    desc: 'Chat privately, then meet at a member event or on your own terms — with Share My Date letting a friend know where you’ll be.',
  },
];

const PRIVACY = [
  { icon: BadgeCheck, title: 'Photo verification', desc: 'Members can verify with a quick selfie check. Look for the verified badge before you say hello.' },
  { icon: EyeOff, title: 'Incognito mode', desc: 'Platinum members can view profiles without showing up in anyone’s “who viewed me” list.' },
  { icon: ImageOff, title: 'Blurred chat photos', desc: 'Photos sent in chat stay blurred until you choose to reveal them. Your screen, your rules.' },
  { icon: ShieldCheck, title: 'Protected photos', desc: 'Profile photos can’t be right-clicked or dragged, and carry a subtle watermark of the person viewing them.' },
  { icon: MoonStar, title: 'Snooze your profile', desc: 'Need a break? Hide your profile instantly and come back whenever you’re ready.' },
  { icon: Flag, title: 'Block, report & Share My Date', desc: 'Block or report anyone in two taps, and send your date plans to a trusted friend from the Safety Centre.' },
];

const FEATURES = [
  { icon: Sparkles, title: 'Transparent compatibility', desc: 'Scores built from mutual interest, shared interests and intentions, age and distance — and we show you why.' },
  { icon: Users, title: 'Inclusive by design', desc: 'Women, men, non-binary people and couples of every kind. Share your identity on your terms, and couples can share one profile or link two.' },
  { icon: CalendarHeart, title: 'Curated events', desc: 'Intimate member gatherings — sundowners, tastings, workshops — where introductions come naturally.' },
  { icon: MessageCircle, title: 'Conversation, not small talk', desc: 'Profile prompts and icebreakers give you something real to reply to, plus a members-only forum.' },
  { icon: Sparkles, title: 'A Daily Spark', desc: 'One light question a day — braai or salads, Joburg or Cape Town — answer it, see what others said, and reply to the ones that make you smile.' },
  { icon: Star, title: 'Trusted by reviews', desc: 'Members who’ve met can review each other — respect, communication, authenticity and reliability. Reviews are double-blind and free for everyone.' },
  { icon: Heart, title: 'Status, badges & a little fun', desc: 'Let people know you’re “Up for coffee” tonight, earn badges as you go, and see what would make your profile shine. All free.' },
];

const TIERS = [
  {
    name: 'Free', price: 'R0', period: 'forever',
    features: ['Browse members & 5 messages a day', 'Search near you (up to 250 km)', 'Singles or couples profile', 'Photo verification badge', 'Read the community forums'],
    cta: 'Join free', style: 'plain' as const,
  },
  {
    name: 'Gold', price: 'R199', period: 'per month',
    features: ['Unlimited messages & search anywhere', 'See who liked & viewed you', 'Private photo access', 'Events & meetups access', 'Monthly profile boost', 'Read receipts & undo swipe'],
    cta: 'Start with Gold', style: 'gold' as const,
  },
  {
    name: 'Platinum', price: 'R349', period: 'per month',
    features: ['Everything in Gold', 'Incognito browsing', 'Weekly profile boost', 'Compatibility insights', 'Video profile'],
    cta: 'Start with Platinum', style: 'crimson' as const,
  },
];

const FAQS = [
  { q: 'Who is Hush for?', a: 'Adults 18 and over — singles and couples — who want to meet like-minded people with discretion and respect. Every orientation and relationship style is welcome.' },
  { q: 'Is it really free to join?', a: 'Yes. Creating a profile, browsing and messaging are free. Gold and Platinum add extra visibility, privacy and search tools if you want them.' },
  { q: 'How do you keep things discreet?', a: 'Chat photos stay blurred until you reveal them, profile photos are protected and watermarked, and you can snooze your profile or (on Platinum) browse incognito. We never post to your social accounts.' },
  { q: 'How do I know people are real?', a: 'Members can complete photo verification and earn a verified badge. You can block or report anyone in a couple of taps, and reports go straight to our moderation team.' },
  { q: 'Where is Hush available?', a: 'We’re starting in South Africa, with members and events growing in Johannesburg, Cape Town and Durban first.' },
];

function SectionHeading({ eyebrow, title, sub, id, tone = 'crimson' }: { eyebrow: string; title: string; sub?: string; id: string; tone?: 'crimson' | 'gold' }) {
  return (
    <div className="text-center mb-12 md:mb-16">
      <p className={`eyebrow mb-3 ${tone === 'gold' ? 'text-[#D4AF37]' : 'text-[#FF4D6D]'}`}>{eyebrow}</p>
      <h2 id={id} className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 text-balance">{title}</h2>
      {sub && <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <LandingNav />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section aria-labelledby="hero-heading" className="relative min-h-[100svh] flex items-center justify-center overflow-hidden animated-gradient pt-24 pb-16">
          <div aria-hidden="true" className="absolute top-1/4 left-1/4 w-72 h-72 md:w-96 md:h-96 bg-[#DC143C]/10 rounded-full blur-3xl float-animation pointer-events-none" />
          <div aria-hidden="true" className="absolute bottom-1/4 right-1/4 w-64 h-64 md:w-80 md:h-80 bg-purple-500/10 rounded-full blur-3xl float-animation-delayed pointer-events-none" />

          <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
            <p className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-xs sm:text-sm text-white/80 mb-8">
              <span aria-hidden="true" className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
              Private dating for singles &amp; couples · 18+
            </p>

            <h1 id="hero-heading" className="font-serif text-[2.75rem] leading-[1.05] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold mb-6">
              Where Connections<br className="hidden sm:block" />{' '}
              Become <span className="text-gradient-crimson">Extraordinary</span>
            </h1>

            <p className="text-white/75 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              A discreet, members-first community for singles and couples in South Africa.
              Verified profiles, privacy you control, and evenings worth dressing up for.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12">
              <Link href="/auth/signup" className="btn-crimson px-8 py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 glow-crimson">
                Join free <ArrowRight size={20} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="glass border border-white/20 hover:border-white/40 px-8 py-4 rounded-xl text-lg font-medium text-white transition-all flex items-center justify-center gap-2">
                See how it works
              </a>
            </div>

            <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 max-w-3xl mx-auto">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label} className="glass rounded-xl px-3 py-3 flex items-center justify-center gap-2 text-left">
                  <Icon className="text-[#D4AF37] flex-shrink-0" size={18} aria-hidden="true" />
                  <span className="text-white/85 text-xs sm:text-sm font-medium leading-tight">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <a href="#how-it-works" aria-label="Scroll to how it works" className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white/70 animate-bounce">
            <ChevronDown size={24} />
          </a>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section id="how-it-works" aria-labelledby="how-heading" className="py-20 md:py-28 px-4 bg-[#0A0A0F] scroll-mt-16">
          <div className="max-w-6xl mx-auto">
            <SectionHeading id="how-heading" eyebrow="How it works" title="Three steps, at your own pace" sub="No pressure, no performance — just a better way to meet people you actually click with." />
            <ol className="grid md:grid-cols-3 gap-5 md:gap-8">
              {STEPS.map(({ num, icon: Icon, title, desc }) => (
                <li key={num} className="glass rounded-2xl p-7 md:p-8 card-hover relative overflow-hidden">
                  <span aria-hidden="true" className="absolute top-4 right-5 text-6xl font-bold text-white/[0.06] font-serif">{num}</span>
                  <div className="w-14 h-14 bg-[#DC143C]/10 border border-[#DC143C]/25 rounded-xl flex items-center justify-center mb-6">
                    <Icon className="text-[#FF4D6D]" size={24} aria-hidden="true" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3 font-serif">{title}</h3>
                  <p className="text-white/70 leading-relaxed">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Privacy & safety ─────────────────────────────────── */}
        <section id="privacy" aria-labelledby="privacy-heading" className="py-20 md:py-28 px-4 bg-gradient-to-b from-[#0A0A0F] to-[#0F0A1E] scroll-mt-16">
          <div className="max-w-6xl mx-auto">
            <SectionHeading id="privacy-heading" tone="gold" eyebrow="Privacy & safety" title="Discretion is the default" sub="The tools to stay private and feel safe are built in — not hidden in settings." />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {PRIVACY.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="glass rounded-2xl p-6 card-hover">
                  <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-4">
                    <Icon className="text-[#D4AF37]" size={20} aria-hidden="true" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
                </li>
              ))}
            </ul>
            <p className="text-center mt-10">
              <Link href="/safety" className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F5E48F] font-medium text-sm">
                Visit the Safety Centre <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section aria-labelledby="features-heading" className="py-20 md:py-28 px-4 bg-[#0F0A1E]">
          <div className="max-w-6xl mx-auto">
            <SectionHeading id="features-heading" eyebrow="Thoughtfully made" title="Everything you need to connect" />
            <ul className="grid sm:grid-cols-2 gap-4 md:gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="glass rounded-2xl p-6 md:p-7 flex gap-5 card-hover sm:last:odd:col-span-2">
                  <div className="w-12 h-12 rounded-xl bg-[#DC143C]/10 border border-[#DC143C]/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="text-[#FF4D6D]" size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg mb-1.5">{title}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Real members (renders nothing until there are enough) ── */}
        <Suspense fallback={null}>
          <MemberShowcase />
        </Suspense>

        {/* ── Membership ───────────────────────────────────────── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="py-20 md:py-28 px-4 bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] scroll-mt-16">
          <div className="max-w-5xl mx-auto">
            <SectionHeading id="pricing-heading" eyebrow="Membership" title="Start free. Upgrade if you love it." sub="Prices in rand, paid securely through our payment provider." />
            <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-start">
              {TIERS.map((tier) => {
                const gold = tier.style === 'gold';
                return (
                  <div key={tier.name} className={`glass rounded-2xl p-7 md:p-8 border relative ${gold ? 'border-[#D4AF37]/50 shadow-lg shadow-[#D4AF37]/10 md:-translate-y-2' : 'border-white/10'}`}>
                    {gold && (
                      <p className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] text-[11px] font-bold tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
                        RECOMMENDED
                      </p>
                    )}
                    <h3 className={`font-serif text-2xl font-bold mb-1 ${gold ? 'text-[#D4AF37]' : 'text-white'}`}>{tier.name}</h3>
                    <p className="flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl font-bold text-white">{tier.price}</span>
                      <span className="text-white/60 text-sm">{tier.period}</span>
                    </p>
                    <ul className="space-y-3 mb-8">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-white/80 text-sm">
                          <Check size={16} aria-hidden="true" className={`mt-0.5 flex-shrink-0 ${gold ? 'text-[#D4AF37]' : 'text-[#FF4D6D]'}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/signup"
                      className={`block text-center py-3.5 rounded-xl font-semibold transition-all ${
                        gold
                          ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] hover:from-[#F4D03F] hover:to-[#D4AF37]'
                          : tier.style === 'crimson'
                          ? 'bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white hover:from-[#FF1744] hover:to-[#DC143C]'
                          : 'glass border border-white/20 hover:border-white/40 text-white'
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading" className="py-20 md:py-24 px-4 bg-[#0A0A0F]">
          <div className="max-w-3xl mx-auto">
            <SectionHeading id="faq-heading" tone="gold" eyebrow="Questions" title="Good to know" />
            <div className="space-y-3">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group glass rounded-2xl px-5 md:px-6 open:border-white/20">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-5 text-white font-medium [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={18} aria-hidden="true" className="text-white/60 flex-shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="text-white/70 text-sm md:text-base leading-relaxed pb-5 -mt-1">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section className="py-16 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden px-6 py-12 md:p-14 text-center" style={{ background: 'linear-gradient(135deg, #DC143C 0%, #9D0208 50%, #6A040F 100%)' }}>
              <div aria-hidden="true" className="absolute inset-0 shimmer pointer-events-none" />
              <span aria-hidden="true" className="absolute -top-4 right-6 text-white/10 font-serif text-[9rem] leading-none font-bold select-none">H</span>
              <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4 relative z-10 text-balance">
                Your next great story starts quietly.
              </h2>
              <p className="text-white/90 text-base md:text-lg mb-8 max-w-xl mx-auto relative z-10">
                Create your free profile in a couple of minutes. Upgrade only if — and when — you want more.
              </p>
              <Link href="/auth/signup" className="relative z-10 inline-flex items-center gap-2 bg-white text-[#9D0208] font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-all text-lg">
                Join Hush free <ArrowRight size={20} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
