import Link from 'next/link'
import { Check } from 'lucide-react'
import { LegalShell, Intro, Section, Strong, A } from '@/components/LegalPage'
import PlanComparison from '@/components/plans/PlanComparison'
import { BUSINESS } from '@/lib/business'
import { MEMBERSHIP_PRICES } from '@/lib/payfast'
import { NEW_MEMBER_UNLIMITED_MESSAGES_DAYS, PLANS } from '@/lib/plans'
import { STORE_NAME, VAT_RATE_PERCENT } from '@/lib/store/config'

export const metadata = {
  title: 'Pricing',
  description: 'Hush membership prices in South African rand: Free, Gold and Platinum, monthly or annual.',
}

function rand(amount: number): string {
  const whole = Number.isInteger(amount)
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

type Card = {
  name: string
  monthly: number
  annual: number | null
  accent: string
  border: string
  blurb: string
  features: string[]
}

const CARDS: Card[] = [
  {
    name: 'Free',
    monthly: 0,
    annual: null,
    accent: 'text-white',
    border: 'border-white/10',
    blurb: 'Everything you need to join, browse and start chatting.',
    features: [
      `${PLANS.FREE.likesPerDay} likes a day + ${PLANS.FREE.superLikes} super like a day`,
      `Messages: unlimited for your first ${NEW_MEMBER_UNLIMITED_MESSAGES_DAYS} days, then ${PLANS.FREE.messagesPer24h} per 24 hours`,
      `Search up to ${PLANS.FREE.maxSearchRadiusKm} km from you`,
      `${PLANS.FREE.dailyPicks} daily picks`,
      'Forums, events RSVP & safety centre',
      `${PLANS.FREE.privateAlbums} private photo album`,
    ],
  },
  {
    name: 'Gold',
    monthly: MEMBERSHIP_PRICES.GOLD.monthly,
    annual: MEMBERSHIP_PRICES.GOLD.annual,
    accent: 'text-[#D4AF37]',
    border: 'border-[#D4AF37]/40',
    blurb: 'Unlimited messaging and the tools to find the right people faster.',
    features: [
      'Unlimited messages & likes',
      `${PLANS.GOLD.superLikes} super likes a week`,
      'See who liked & viewed you',
      'Search anywhere, travel mode & advanced filters',
      `Read receipts & ${PLANS.GOLD.priorityMessagesPerWeek} priority messages a week`,
      'Monthly profile boost & priority in search',
      'Unlimited private albums & host events',
    ],
  },
  {
    name: 'Platinum',
    monthly: MEMBERSHIP_PRICES.PLATINUM.monthly,
    annual: MEMBERSHIP_PRICES.PLATINUM.annual,
    accent: 'text-purple-300',
    border: 'border-purple-400/40',
    blurb: 'Maximum visibility and privacy.',
    features: [
      'Everything in Gold',
      `${PLANS.PLATINUM.superLikes} super likes a week & unlimited priority messages`,
      'Weekly profile boost & spotlight in discover',
      'Incognito browsing',
      'Video profile & compatibility insights',
      'Profile insights dashboard',
    ],
  },
]

export default function PricingPage() {
  const vatRegistered = !!BUSINESS.vatNumber

  return (
    <LegalShell eyebrow="Membership" title="Pricing" lastUpdated="15 October 2026">
      <Intro>
        <p>
          Joining Hush is free. Gold and Platinum are optional paid plans that add extra messaging, visibility and privacy tools. All prices are in <Strong>South African rand (ZAR)</Strong>
          {vatRegistered ? <> and include VAT at {VAT_RATE_PERCENT}%</> : null}. The price you see is the price you pay — no hidden fees.
        </p>
      </Intro>

      <div className="grid md:grid-cols-3 gap-5">
        {CARDS.map((c) => {
          const perMonthOnAnnual = c.annual ? Math.round(c.annual / 12) : null
          const saving = c.annual ? Math.round((1 - c.annual / (c.monthly * 12)) * 100) : null
          return (
            <div key={c.name} className={`glass rounded-2xl p-6 border ${c.border} flex flex-col`}>
              <h2 className={`text-2xl font-serif font-bold mb-1 ${c.accent}`}>{c.name}</h2>
              <p className="text-gray-400 text-sm mb-4">{c.blurb}</p>
              <p className="mb-1">
                <span className="text-3xl font-bold text-white">{rand(c.monthly)}</span>
                <span className="text-gray-400 text-sm"> {c.monthly === 0 ? 'forever' : '/ month'}</span>
              </p>
              {c.annual ? (
                <p className="text-gray-300 text-sm mb-5">
                  or <Strong>{rand(c.annual)} / year</Strong> (≈ {rand(perMonthOnAnnual!)}/month{saving ? `, save ${saving}%` : ''})
                </p>
              ) : (
                <p className="text-gray-300 text-sm mb-5">No card needed</p>
              )}
              <ul className="space-y-2 text-sm text-gray-300 flex-1">
                {c.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={16} className={`flex-shrink-0 mt-0.5 ${c.accent}`} aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className={`mt-6 block text-center py-3 rounded-xl font-semibold transition-all ${c.monthly === 0 ? 'border border-white/15 text-white hover:bg-white/5' : 'bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white'}`}
              >
                {c.monthly === 0 ? 'Join free' : `Join & choose ${c.name}`}
              </Link>
            </div>
          )
        })}
      </div>

      <Section title="Compare every feature">
        <PlanComparison />
      </Section>

      <Section title="Billing, renewal & cancellation">
        <ul className="list-disc list-inside space-y-1.5 pl-4">
          <li>Paid plans are charged in advance when you upgrade, through our secure payment provider. We never see or store your card details.</li>
          <li>Plans renew automatically at the same price for the same period (monthly or yearly) until you cancel. We give at least 30 days&apos; notice of any price change.</li>
          <li>You can cancel at any time; your paid features stay active until the end of the period you&apos;ve paid for, then your account moves to the Free plan.</li>
          <li>First-time upgrades can be refunded in full if you cancel within 7 days. Details are in our <A href="/refunds">Refund &amp; Cancellation Policy</A>.</li>
          <li>You must be 18 or older to join. Sign up first, then upgrade from inside your account.</li>
        </ul>
      </Section>

      <Section title={`${STORE_NAME} store prices`}>
        <p>
          {STORE_NAME}, our store for adult products, shows the price of each product on its product page, in rand{vatRegistered ? ` and including VAT` : ''}. Delivery is charged separately at checkout — see our <A href="/shipping">Shipping &amp; Delivery Policy</A> for current delivery fees.
        </p>
      </Section>

      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-gray-300 mb-4">Ready to meet like-minded singles and couples?</p>
        <Link href="/auth/signup" className="inline-block bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold transition-all">
          Join Hush free
        </Link>
        <p className="text-gray-400 text-sm mt-4">Questions? <A href="/contact">Contact us</A>.</p>
      </div>
    </LegalShell>
  )
}
