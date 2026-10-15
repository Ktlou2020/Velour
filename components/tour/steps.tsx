import type { ReactNode } from 'react'
import Link from 'next/link'
import { Sparkles, Users, Compass, Images, MessageCircle, Bell, User, ShieldCheck, type LucideIcon } from 'lucide-react'
import { NEW_MEMBER_UNLIMITED_MESSAGES_DAYS, PLANS } from '@/lib/plans'

export type TourStep = {
  id: string
  title: string
  icon: LucideIcon
  body: ReactNode
  /**
   * `data-tour` values to spotlight, in priority order. The first one with a
   * visible element wins (desktop bar vs mobile tab bar vs menu button).
   * Empty/none visible → the step shows as a centred card.
   */
  targets?: string[]
}

const KBD = 'inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-white/20 bg-white/5 text-[11px] font-sans text-white/80'

const FREE_DAILY = PLANS.FREE.messagesPer24h

export function buildSteps(onLinkClick: () => void): TourStep[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome to Hush',
      icon: Sparkles,
      body: (
        <>
          Here’s a one-minute look around so you know where everything lives.
          Use <kbd className={KBD}>←</kbd> <kbd className={KBD}>→</kbd> or the buttons below.
        </>
      ),
    },
    {
      id: 'members',
      title: 'Members',
      icon: Users,
      targets: ['members', 'menu'],
      body: <>Your home base. Browse singles and couples near you, and search or filter by distance, age and what they’re looking for.</>,
    },
    {
      id: 'discover',
      title: 'Discover',
      icon: Compass,
      targets: ['discover', 'menu'],
      body: <>One profile at a time: like ❤️, send a wink 😉 or pass. When you both like each other, it’s a match.</>,
    },
    {
      id: 'explore',
      title: 'Explore',
      icon: Images,
      targets: ['explore', 'menu'],
      body: <>The public photo gallery. Like photos you love and find people through their pictures.</>,
    },
    {
      id: 'messages',
      title: 'Messages',
      icon: MessageCircle,
      targets: ['messages', 'menu'],
      body: (
        <>
          Chat with your matches here.
          {FREE_DAILY != null && (
            <span className="block mt-1.5 text-white/55 text-[13px]">
              Messaging is unlimited for your first {NEW_MEMBER_UNLIMITED_MESSAGES_DAYS} days, then {FREE_DAILY} a day on the free plan.
              Upgrade any time for unlimited.
            </span>
          )}
        </>
      ),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      targets: ['notifications'],
      body: <>Likes, winks, matches and profile views show up here, so you never miss a spark.</>,
    },
    {
      id: 'profile',
      title: 'Your profile',
      icon: User,
      targets: ['profile', 'menu'],
      body: <>Add photos and pick your profile picture, tune your privacy settings and create private albums you share only with people you choose.</>,
    },
    {
      id: 'finish',
      title: 'Stay safe, have fun',
      icon: ShieldCheck,
      body: (
        <>
          Take your time, meet in public first and never send money to anyone you meet here.
          Find tips, blocking and reporting in the{' '}
          <Link href="/safety" onClick={onLinkClick} className="text-[#D4AF37] underline underline-offset-2 hover:text-[#e6c65a]">
            Safety Centre
          </Link>.
          <span className="block mt-1.5 text-white/55 text-[13px]">Replay this tour any time from the account menu (the ☰ menu on mobile).</span>
        </>
      ),
    },
  ]
}
