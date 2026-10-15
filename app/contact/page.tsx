import { LegalShell, Intro, Section, Strong, A, Mail, BusinessDetails } from '@/components/LegalPage'
import { BUSINESS } from '@/lib/business'
import { ORDER_NUMBER_PREFIX, STORE_NAME } from '@/lib/store/config'

export const metadata = {
  title: 'Contact us',
  description: 'How to contact Hush support, our business details, and links to our policies.',
}

const POLICIES = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refunds', label: 'Refund & Cancellation Policy' },
  { href: '/shipping', label: 'Shipping & Delivery Policy' },
  { href: '/safety', label: 'Safety Centre' },
]

export default function ContactPage() {
  return (
    <LegalShell eyebrow="Support" title="Contact us" lastUpdated="15 October 2026">
      <Intro>
        <p>
          We&apos;re a small South African team and a real person reads every message. The quickest way to reach us is by email at <Mail />.
          {BUSINESS.phone ? <> You can also call us on <a href={`tel:${BUSINESS.phone.replace(/[^\d+]/g, '')}`} className="text-[#DC143C] hover:underline">{BUSINESS.phone}</a> during business hours.</> : null}
        </p>
        <p>
          <Strong>Response times:</Strong> we reply to most messages within <Strong>1 business day</Strong>, and always within 2 business days (Monday to Friday, excluding South African public holidays).
        </p>
      </Intro>

      <BusinessDetails heading="Business details" showInfoOfficer />

      <Section title="How we can help">
        <ul className="list-disc list-inside space-y-1.5 pl-4">
          <li><Strong>Account &amp; membership:</Strong> sign-in problems, billing questions or cancelling a plan — email <Mail subject="Account help" /> from your account&apos;s email address and include your username.</li>
          <li><Strong>{STORE_NAME} orders:</Strong> deliveries, returns and refunds — email <Mail subject="Order query" /> and quote your order number (it starts with &quot;{ORDER_NUMBER_PREFIX}-&quot;).</li>
          <li><Strong>Privacy &amp; your data (POPIA):</Strong> requests to access, correct or delete your personal information — email <Mail subject="POPIA request" />{BUSINESS.informationOfficer ? <>, for the attention of our Information Officer, {BUSINESS.informationOfficer}</> : null}.</li>
          <li><Strong>Safety concerns:</Strong> use the Report button on any profile or message for the fastest response, or email <Mail subject="Safety report" />. If you are in immediate danger, call SAPS on <Strong>10111</Strong> or <Strong>112</Strong> from a mobile phone.</li>
          <li><Strong>Leaked photos or videos:</Strong> report them from the member&apos;s profile (&quot;Shared my photos/videos outside Hush&quot;) or email us — we act on these urgently.</li>
        </ul>
        <p>
          Visit our <A href="/safety">Safety Centre</A> for dating safety tips and Share My Date.
        </p>
      </Section>

      <Section title="Our policies">
        <ul className="grid sm:grid-cols-2 gap-3">
          {POLICIES.map((p) => (
            <li key={p.href}>
              <A href={p.href}>{p.label}</A>
            </li>
          ))}
        </ul>
      </Section>
    </LegalShell>
  )
}
