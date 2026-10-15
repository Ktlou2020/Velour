import { LegalShell, Intro, Section, Strong, A, Mail, BusinessDetails } from '@/components/LegalPage'
import { OPERATOR_NAME } from '@/lib/business'
import { STORE_NAME } from '@/lib/store/config'
import { storeSettings } from '@/lib/store/settings'
import { formatRand } from '@/lib/store/format'

export const metadata = {
  title: 'Shipping & Delivery Policy',
  description: 'Where Toystory delivers, discreet packaging, delivery times, fees and tracking.',
}

export default function ShippingPage() {
  const s = storeSettings()
  const freeOver = s.freeShippingOverCents > 0 ? s.freeShippingOverCents : null

  return (
    <LegalShell title="Shipping & Delivery Policy" lastUpdated="15 October 2026">
      <Intro>
        <p>
          This policy covers orders from {STORE_NAME}, the Unbound store for adult products, operated by {OPERATOR_NAME}. Unbound memberships are digital and are not shipped — they are active as soon as your payment is confirmed.
        </p>
      </Intro>

      <Section n={1} title="Where we deliver">
        <p>
          We deliver to addresses in all nine provinces of <Strong>South Africa only</Strong>. We do not ship internationally.
        </p>
      </Section>

      <Section n={2} title="18+ only">
        <p>
          {STORE_NAME} sells adult products. By ordering you confirm that you <Strong>and the person receiving the parcel</Strong> are at least 18 years old. We may cancel and refund any order we reasonably believe was placed by or for a minor.
        </p>
      </Section>

      <Section n={3} title="Discreet packaging">
        <p>
          Discreet packaging is <Strong>on by default</Strong>. Your order ships in a plain, unbranded outer box or satchel with no product names, images or adult-store logos on the outside. The sender is shown as <Strong>&quot;{s.discreetSender}&quot;</Strong>.
        </p>
        <p>
          Order emails and notifications show only your order number and status — never product names. Your purchases are not shown on your profile or to other members.
        </p>
      </Section>

      <Section n={4} title="Delivery fees">
        <div className="glass rounded-2xl p-5 space-y-2">
          <p className="flex flex-wrap justify-between gap-2">
            <span>Standard courier delivery, anywhere in South Africa</span>
            <Strong>{formatRand(s.shippingCents)}</Strong>
          </p>
          {freeOver && (
            <p className="flex flex-wrap justify-between gap-2">
              <span>Orders of {formatRand(freeOver)} or more (before delivery)</span>
              <Strong>Free</Strong>
            </p>
          )}
        </div>
        <p>
          The delivery fee is a single flat fee per order and is shown in your cart and at checkout before you pay. Prices are in South African rand.
        </p>
      </Section>

      <Section n={5} title="Processing and delivery times">
        <ul className="list-disc list-inside space-y-1.5 pl-4">
          <li><Strong>Processing:</Strong> orders are packed and handed to the courier within <Strong>1–2 business days</Strong> of payment being confirmed. Orders paid on weekends or public holidays are processed the next business day.</li>
          <li><Strong>Main centres</Strong> (e.g. Johannesburg, Pretoria, Cape Town, Durban): usually <Strong>2–4 business days</Strong> after dispatch.</li>
          <li><Strong>Regional and outlying areas:</Strong> usually <Strong>3–7 business days</Strong> after dispatch.</li>
        </ul>
        <p>
          These are estimates, not guarantees — courier delays, public holidays and peak seasons can add time. If your order is delayed on our side, we will let you know by email.
        </p>
      </Section>

      <Section n={6} title="Courier and tracking">
        <p>
          We use reputable South African couriers (such as The Courier Guy, Aramex or Dawn Wing). When your order ships we email you the courier&apos;s name and a tracking number or link, and the same details appear on your order page under <A href="/store/orders">My orders</A>. Order statuses are: Pending payment, Paid, Processing, Shipped and Delivered.
        </p>
      </Section>

      <Section n={7} title="Failed or missed delivery">
        <p>
          The courier will usually contact you by phone or SMS on the delivery day, so please give a correct mobile number and an address where someone (18+) can receive the parcel.
        </p>
        <ul className="list-disc list-inside space-y-1.5 pl-4">
          <li>If a delivery attempt fails, the courier will normally try again or arrange a new time with you.</li>
          <li>If the parcel is returned to us because the address was wrong or incomplete, or nobody could receive it after repeated attempts, we will contact you. We can re-send it for a further delivery fee at our cost price, or cancel the order and refund the product price.</li>
          <li>Please check that your parcel is sealed and undamaged on delivery. If it is damaged, lost, or contains the wrong item, contact us within 7 days and we will put it right — see our <A href="/refunds">Refund &amp; Cancellation Policy</A>.</li>
        </ul>
        <p>
          Risk in the goods passes to you on delivery to the address you gave.
        </p>
      </Section>

      <Section n={8} title="Questions about a delivery">
        <p>
          Email <Mail subject="Delivery query" /> and quote your order number. We reply within 1–2 business days.
        </p>
      </Section>

      <BusinessDetails heading="Contact us" />
    </LegalShell>
  )
}
