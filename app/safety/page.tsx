import Link from 'next/link'
import { LogoMark } from '@/components/Logo'
import {
  ArrowLeft, MapPin, Users, Car, Video, Wallet, HeartPulse, Flag, Phone, ShieldCheck, Wine, Lock,
} from 'lucide-react'
import { auth } from '@/auth'
import Footer from '@/components/Footer'
import ShareDateClient from './ShareDateClient'

export const metadata = {
  title: 'Safety Centre',
  description: 'Practical tips for meeting Unbound members in person, emergency numbers for South Africa, and Share My Date.',
}

const TIPS = [
  {
    icon: Video,
    title: 'Video call first',
    body: 'A quick video chat before meeting confirms they are who their photos say they are. If someone keeps dodging a call, treat that as a red flag.',
  },
  {
    icon: MapPin,
    title: 'Meet somewhere public',
    body: 'Choose a busy café, restaurant or bar for the first few dates. Never meet at your home, their home or a secluded spot until you know them well.',
  },
  {
    icon: Users,
    title: 'Tell a friend',
    body: 'Let someone you trust know who you are meeting, where and when. Use Share My Date below to email them the details, then check in when you are safe.',
  },
  {
    icon: Car,
    title: 'Arrange your own transport',
    body: 'Get yourself there and back — drive, use a ride-hailing app or public transport. Don’t accept a lift from your date, and keep your phone charged.',
  },
  {
    icon: Wallet,
    title: 'Keep your finances private',
    body: 'Never send money, gift cards or crypto, and never share banking details, ID numbers or passwords — however convincing the story. Report anyone who asks.',
  },
  {
    icon: Wine,
    title: 'Stay in control',
    body: 'Know your limits with alcohol, keep an eye on your drink, and never leave it unattended. If you feel unusually drowsy or unwell, ask venue staff for help.',
  },
  {
    icon: Lock,
    title: 'Protect your personal details',
    body: 'Keep your home address, workplace and daily routine to yourself until trust is built. Be mindful of what photos and social links reveal.',
  },
  {
    icon: HeartPulse,
    title: 'Trust your instincts',
    body: 'If something feels off, it’s OK to leave — you don’t owe anyone an explanation. Ask venue staff to help you get a ride or call someone if you need to.',
  },
]

const EMERGENCY = [
  { label: 'SAPS Emergency', number: '10111', tel: '10111', note: 'Police flying squad' },
  { label: 'Mobile emergency', number: '112', tel: '112', note: 'Free from any mobile phone' },
  { label: 'GBV Command Centre', number: '0800 428 428', tel: '0800428428', note: '24/7 gender-based violence support' },
]

export default async function SafetyPage() {
  const session = await auth()
  const isLoggedIn = !!session?.user?.id

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={isLoggedIn ? '/members' : '/'} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Unbound</span>
          </Link>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="font-serif font-bold tracking-wide text-white">UNBOUND</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-[#DC143C]/50 to-transparent" />
            <span className="text-[#D4AF37] text-xs font-medium tracking-widest uppercase">Safety</span>
            <div className="h-px flex-1 bg-gradient-to-l from-[#DC143C]/50 to-transparent" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-white mt-4 mb-3">Safety Centre</h1>
          <p className="text-gray-400 leading-relaxed max-w-2xl">
            Meeting someone new should be exciting, not stressful. These practical steps help you stay in control —
            before, during and after a date.
          </p>
        </div>

        {/* Emergency numbers */}
        <section aria-labelledby="emergency-heading" className="glass rounded-2xl p-6 mb-10 border border-[#DC143C]/30">
          <h2 id="emergency-heading" className="text-xl font-serif font-bold text-white mb-1 flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#DC143C]" />
            In an emergency (South Africa)
          </h2>
          <p className="text-gray-400 text-sm mb-5">If you or someone else is in immediate danger, call for help first.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {EMERGENCY.map((e) => (
              <a
                key={e.tel}
                href={`tel:${e.tel}`}
                className="rounded-xl bg-[#DC143C]/10 border border-[#DC143C]/30 hover:bg-[#DC143C]/20 transition-colors p-4 block"
              >
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{e.label}</p>
                <p className="text-white font-bold text-2xl font-serif">{e.number}</p>
                <p className="text-gray-400 text-xs mt-1">{e.note}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section aria-labelledby="tips-heading" className="mb-12">
          <h2 id="tips-heading" className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            Meeting in person
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {TIPS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
                  <h3 className="text-white font-semibold">{title}</h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Content protection */}
        <section id="content-protection" aria-labelledby="protection-heading" className="mb-12 scroll-mt-24">
          <h2 id="protection-heading" className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
              <Lock className="w-4 h-4" />
            </span>
            Content protection
          </h2>
          <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
            <p>
              <strong className="text-white">Screenshots, screen recordings, saving and sharing members&apos; photos or videos are not allowed.</strong>{' '}
              Saving is blocked across Unbound: no right-click or long-press &ldquo;Save image&rdquo;, no video downloads, picture-in-picture or casting, and photos blur when you switch apps or print.
            </p>
            <p>
              <strong className="text-white">Every copy is traceable.</strong> Each photo is served with a watermark of the viewer&apos;s username and the date burned into the image itself, so a screenshot or saved copy names the account that took it. Videos carry their owner&apos;s mark in the file and the viewer&apos;s username on screen. Your own photos look clean to you.
            </p>
            <p>
              <strong className="text-white">To be honest about the limits:</strong> no website can fully stop a screenshot or a phone pointed at a screen. What we can do is make a copy useless to a thief and lead straight back to them.
            </p>
            <p>
              <strong className="text-white">If your content was shared outside Unbound:</strong> report the member from their profile (flag icon) or from the photo, and choose <em>&ldquo;Shared my photos/videos outside Unbound&rdquo;</em>. If you have the leaked copy, email it to{' '}
              <a href="mailto:support@unbound.dating" className="text-[#DC143C] hover:underline">support@unbound.dating</a> — the watermark tells us who saved it. Confirmed leaks lead to a permanent ban.
            </p>
          </div>
        </section>

        {/* Report & block */}
        <section aria-labelledby="report-heading" className="mb-12">
          <h2 id="report-heading" className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] flex-shrink-0">
              <Flag className="w-4 h-4" />
            </span>
            Reporting &amp; blocking on Unbound
          </h2>
          <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
            <p>
              <strong className="text-white">Report a member:</strong> open their profile and tap the{' '}
              <Flag className="inline w-4 h-4 text-[#DC143C] align-text-bottom" aria-label="flag" /> flag icon, choose a reason and
              add any details. Reports are confidential — the member is never told who reported them — and our moderation team reviews every one.
            </p>
            <p>
              <strong className="text-white">Block a member:</strong> if you&apos;d rather not hear from someone again, block them. They aren&apos;t notified, they can&apos;t start a new conversation with you, and you won&apos;t see each other in member search or event attendee lists. You can also simply unmatch or stop replying — you never owe anyone a conversation.
            </p>
            <p>
              <strong className="text-white">Report anything that worries you:</strong> requests for money, pressure to move off the platform quickly, fake or stolen photos, harassment, threats, or anyone who appears to be under 18.
            </p>
            <p>
              If something happened offline, please also report it to SAPS. You can contact our team at{' '}
              <a href="mailto:support@unbound.dating" className="text-[#DC143C] hover:underline">support@unbound.dating</a>.
            </p>
          </div>
        </section>

        {/* Share my date */}
        <section id="share-my-date" aria-labelledby="share-heading" className="scroll-mt-24">
          <h2 id="share-heading" className="text-2xl font-serif font-bold text-white mb-2 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
              <Users className="w-4 h-4" />
            </span>
            Share my date
          </h2>
          <p className="text-gray-400 leading-relaxed mb-6 pl-11">
            Email a trusted friend who you&apos;re meeting, where and when. When you&apos;re home safe, tap
            &ldquo;I&apos;m safe&rdquo; and we&apos;ll let them know.
          </p>
          {isLoggedIn ? (
            <ShareDateClient />
          ) : (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-gray-300 mb-4">Sign in to share your date plans with a friend.</p>
              <Link
                href="/auth/signin"
                className="inline-block bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Sign in
              </Link>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </div>
  )
}
