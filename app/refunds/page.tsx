import { LegalShell, Intro, Section, Strong, A, Mail, BusinessDetails } from '@/components/LegalPage'
import { OPERATOR_NAME } from '@/lib/business'
import { STORE_NAME, RESERVATION_MINUTES } from '@/lib/store/config'

export const metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'How to cancel an Unbound membership, cancel or return a Toystory order, and how refunds are paid.',
}

export default function RefundsPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy" lastUpdated="15 October 2026">
      <Intro>
        <p>
          This policy explains how you can cancel a paid Unbound membership, cancel or return an order from the {STORE_NAME} store, and how and when refunds are paid. It is offered by {OPERATOR_NAME} and forms part of our <A href="/terms">Terms of Service</A>.
        </p>
        <p>
          Nothing in this policy limits your rights under the <Strong>Consumer Protection Act 68 of 2008</Strong> (CPA) or the <Strong>Electronic Communications and Transactions Act 25 of 2002</Strong> (ECTA). Where the law gives you more than this policy, the law applies.
        </p>
      </Intro>

      <Section n={1} title="Membership plans (Gold & Platinum)">
        <p>
          Creating an account and using the Free plan costs nothing. Gold and Platinum are paid plans, billed in advance in South African rand for the period you choose — monthly or annually. Current prices are on our <A href="/pricing">pricing page</A>.
        </p>
        <p>
          <Strong>Renewal.</Strong> When you upgrade, you authorise our payment provider to charge the same amount again at the start of each new period (every month, or every year for annual plans) until you cancel. The amount and period are shown before you pay. We will give you at least 30 days&apos; notice before any price change affects your renewal.
        </p>
        <p>
          <Strong>How to cancel.</Strong> You can cancel at any time with the &quot;Cancel membership&quot; button on your <A href="/subscription">Subscription page</A>. This stops the recurring payment with our payment provider straight away, so no further charges are made, and we confirm the cancellation by email. If you can&apos;t use the button, email <Mail subject="Cancel subscription" /> from the email address on your account and give your username — we&apos;ll cancel it for you.
        </p>
        <p>
          <Strong>What happens to your access.</Strong> After you cancel, your paid features stay active until the end of the period you have already paid for. Your account then moves to the Free plan — your profile, matches and messages are kept, but premium features switch off. To avoid being charged for the next period, cancel at least one business day before your renewal date.
        </p>
      </Section>

      <Section n={2} title="Membership refunds">
        <p>
          <Strong>Seven-day cooling-off on your first purchase.</Strong> Section 44 of ECTA gives consumers a seven-day cooling-off period for many online purchases, but it does not apply to services that, with your consent, begin before the seven days have passed — and a membership starts as soon as you pay. We nevertheless offer this: if you cancel within <Strong>7 days of your first payment</Strong> for a Gold or Platinum plan, we will refund that payment in full and your account will return to the Free plan. This applies once per member.
        </p>
        <p>
          <Strong>Monthly plans.</Strong> Outside the first-purchase window, monthly payments are not refunded for unused days in the current month; cancelling stops future payments, and you keep your features until the month ends.
        </p>
        <p>
          <Strong>Annual plans.</Strong> If you cancel an annual plan after the first seven days, you keep your features until the end of the paid year. Where section 14 of the CPA applies to your agreement, you may instead ask us to end it early on 20 business days&apos; notice; we will then refund the unused part of the year on a pro-rata basis, less any reasonable cancellation charge the CPA and its regulations allow.
        </p>
        <p>
          <Strong>Charges we will always refund.</Strong> A duplicate charge, a charge taken after you cancelled in time, a charge for the wrong plan or amount, or a period in which a fault on our side meant you could not use your paid features — contact us and we will put it right.
        </p>
        <p>
          <Strong>Suspended accounts.</Strong> If an account is suspended or closed for a serious breach of our Terms (for example harassment, fraud, or content involving minors), we may withhold a refund for the current period, as far as the law allows.
        </p>
      </Section>

      <Section n={3} title={`${STORE_NAME} orders — cancelling`}>
        <p>
          <Strong>Before you pay.</Strong> Items are reserved for {RESERVATION_MINUTES} minutes while you complete payment. You can cancel an unpaid order from your order page at any time, and unpaid orders are cancelled automatically when the reservation ends. Nothing is charged.
        </p>
        <p>
          <Strong>After you pay, before it ships.</Strong> Email us with your order number as soon as possible. If the order has not yet been handed to the courier, we will cancel it and refund you in full, including the delivery fee.
        </p>
        <p>
          <Strong>After it ships.</Strong> The order can no longer be cancelled, but you can return it under section 4 below.
        </p>
        <p>
          If a product turns out to be unavailable or was clearly mispriced after you paid, we will contact you and refund the affected items (or the whole order, if you prefer) in full.
        </p>
      </Section>

      <Section n={4} title={`${STORE_NAME} orders — returns`}>
        <p>
          <Strong>Hygiene comes first.</Strong> Intimate products cannot be resold once opened, so for health reasons we only accept change-of-mind returns of items that are <Strong>unopened, unused and in their original sealed packaging</Strong>. We never resell returned items.
        </p>
        <p>
          <Strong>Changed your mind (cooling-off).</Strong> Under section 44 of ECTA you may cancel an online purchase within <Strong>7 days of receiving the goods</Strong>. Email us within that time, then send the sealed item back to the address we give you. You pay only the direct cost of returning it; we refund the price of the item and the original delivery fee.
        </p>
        <p>
          <Strong>Defective, damaged or incorrect items.</Strong> Under sections 55 and 56 of the CPA you may return a product that is defective, unsafe or not what you ordered within <Strong>6 months</Strong> of delivery — opened or not — and choose a repair, a replacement or a refund. Please tell us as soon as you notice the problem (ideally within 7 days for parcels that arrive damaged or with the wrong item) and send a photo if you can. We cover the return cost for these items. Please clean a used item before sending it back. Damage caused by misuse, normal wear, or using an incompatible lubricant is not a defect.
        </p>
        <p>
          <Strong>How to request a return.</Strong> Email <Mail subject="Return request" /> with your order number, the item(s), the reason and, for a defect or damage, a photo. We reply within 2 business days with return instructions — please don&apos;t send anything back before you hear from us.
        </p>
      </Section>

      <Section n={5} title="How and when refunds are paid">
        <ul className="list-disc list-inside space-y-1.5 pl-4">
          <li>Refunds go back to the <Strong>original payment method</Strong> (card or account) used for the purchase. We cannot refund to a different card or account.</li>
          <li>We process an approved refund within <Strong>7–10 business days</Strong>: for a returned item, counted from when it reaches us and is checked; for a cancelled order or membership, from when we approve the request. In every case we refund within the 30 days ECTA requires.</li>
          <li>Once we have processed it, your bank may take a few further working days to show it on your statement.</li>
          <li>We email you when a refund is made, and store orders show the status &quot;Refunded&quot;.</li>
        </ul>
      </Section>

      <Section n={6} title="Chargebacks and payment disputes">
        <p>
          If you don&apos;t recognise a charge or think something went wrong, please contact us first — most problems are resolved quickly and a refund through us is usually faster than a bank dispute. Card charges may show on your statement under our payment provider&apos;s name.
        </p>
        <p>
          You remain free to dispute a charge with your bank. While a chargeback is open we may pause the paid features or order linked to it, and if a chargeback is reversed in our favour the original charge stands. Filing chargebacks for purchases you made and received, after you have been refunded, may lead to the account being closed.
        </p>
      </Section>

      <Section n={7} title="Complaints">
        <p>
          If you are not happy with how we handled a cancellation or refund, reply to our email or write to <Mail subject="Complaint" /> and ask for it to be escalated. If we cannot resolve it, you may refer the matter to the National Consumer Commission or the Consumer Goods and Services Ombud (CGSO).
        </p>
      </Section>

      <BusinessDetails
        heading="Contact us about a refund"
        blurb={<p>Please include your username or order number. See also our <A href="/shipping">Shipping &amp; Delivery Policy</A> and <A href="/contact">Contact page</A>.</p>}
      />
    </LegalShell>
  )
}
