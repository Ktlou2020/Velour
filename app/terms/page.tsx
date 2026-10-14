import Link from 'next/link'
import { LogoMark } from '@/components/Logo'
import { ArrowLeft } from 'lucide-react'
import { STORE_NAME, SUPPORT_EMAIL } from '@/lib/store/config'

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for the Hush lifestyle dating community.',
}

export default function TermsPage() {
  const lastUpdated = '14 October 2026'

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Hush</span>
          </Link>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="font-serif font-bold tracking-wide text-white">HUSH</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-[#DC143C]/50 to-transparent" />
            <span className="text-[#D4AF37] text-xs font-medium tracking-widest uppercase">Legal</span>
            <div className="h-px flex-1 bg-gradient-to-l from-[#DC143C]/50 to-transparent" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-white mt-4 mb-3">Terms of Service</h1>
          <p className="text-gray-400 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Intro */}
          <div className="glass rounded-2xl p-6">
            <p className="text-gray-300 leading-relaxed">
              Welcome to Hush. These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Hush platform, including our website, mobile application, and all related services (collectively, the &quot;Service&quot;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.
            </p>
            <p className="text-gray-300 leading-relaxed mt-3">
              Hush is operated by Hush (Pty) Ltd, a company incorporated in South Africa. Our registered address and contact information are listed at the end of this document.
            </p>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">1</span>
              Eligibility
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>You must be at least <strong className="text-white">18 years of age</strong> to register for or use the Service. By creating an account, you represent and warrant that you are 18 or older and that all information you provide is accurate, current, and complete.</p>
              <p>The Service is intended for adults seeking lifestyle connections, companionship, and dating. It is not intended for minors under any circumstances. Hush reserves the right to terminate any account we have reason to believe belongs to a minor, without notice.</p>
              <p>By using the Service, you also represent that you are not prohibited from using online services under the laws of South Africa or any other applicable jurisdiction.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">2</span>
              Account Registration
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>To access most features of the Service, you must register for an account. You agree to provide accurate, complete, and up-to-date information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.</p>
              <p>You may only maintain one account. Creating multiple accounts to circumvent bans, restrictions, or subscription limits is prohibited and will result in permanent termination of all accounts.</p>
              <p>You must notify us immediately at <a href="mailto:support@hush.dating" className="text-[#DC143C] hover:underline">support@hush.dating</a> if you suspect unauthorised use of your account.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">3</span>
              Acceptable Use
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You may use the Service to:</p>
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Create a genuine profile representing yourself</li>
                <li>Connect with other adult members</li>
                <li>Participate in the community forums and events</li>
                <li>Use messaging and matching features within the platform</li>
              </ul>
              <p className="mt-3">The Service is intended for consensual adult connections. All interactions must be respectful, honest, and lawful.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">4</span>
              Prohibited Content &amp; Conduct
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>You agree that you will NOT:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-4">
                <li>Post, upload, or share any content involving minors in a sexual or exploitative context</li>
                <li>Harass, threaten, stalk, bully, or intimidate other members</li>
                <li>Use the Service for prostitution, solicitation, or any commercial sexual transaction</li>
                <li>Impersonate any person or entity, or misrepresent your identity or age</li>
                <li>Distribute spam, chain messages, or unsolicited commercial communications</li>
                <li>Post content that is defamatory, discriminatory, or incites hatred based on race, gender, religion, nationality, sexual orientation, or disability</li>
                <li>Upload malware, viruses, or any code that could harm the Service or other users</li>
                <li>Attempt to gain unauthorised access to any part of the Service or another user&apos;s account</li>
                <li>Scrape, crawl, or otherwise collect user data without our written consent</li>
                <li>Screenshot, screen-record, download, save, copy or share another member&apos;s photos, videos, messages or profile content outside Hush, by any means, without that member&apos;s explicit permission</li>
                <li>Use the Service in any way that violates South African law or any other applicable law</li>
              </ul>
              <p className="mt-3">Violation of these prohibitions may result in immediate account termination and may be reported to law enforcement authorities.</p>
              <p id="content-protection" className="mt-3 scroll-mt-24"><strong className="text-white">Members&apos; content stays on Hush.</strong> Every photo you view on Hush carries a watermark specific to you (your username and the date), and members&apos; videos carry the owner&apos;s mark plus your username on screen. A saved, screenshotted or recorded copy therefore identifies the account that made it. Sharing members&apos; content outside Hush leads to a permanent ban, and we may share the identifying information with the affected member and with law enforcement, including under the Cybercrimes Act 19 of 2020 and the Protection of Personal Information Act. Members can report leaked content from a member&apos;s profile or a photo (&quot;Shared my photos/videos outside Hush&quot;) or by emailing <a href="mailto:support@hush.dating" className="text-[#DC143C] hover:underline">support@hush.dating</a>.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">5</span>
              User Content
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>You retain ownership of the content you post (&quot;User Content&quot;). By submitting User Content to the Service, you grant Hush a non-exclusive, worldwide, royalty-free, sublicensable licence to use, reproduce, modify, display, and distribute that content solely for the purpose of operating and improving the Service.</p>
              <p>You represent and warrant that you own or have the necessary rights to all User Content you post, and that your User Content does not infringe any third-party intellectual property, privacy, or other rights.</p>
              <p>We reserve the right (but not the obligation) to review, remove, or edit any User Content at our sole discretion.</p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">6</span>
              Intellectual Property
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>The Service and all its original content (excluding User Content), features, and functionality are and shall remain the exclusive property of Hush (Pty) Ltd and its licensors. The Hush name, logo, and all related marks are trademarks of Hush (Pty) Ltd.</p>
              <p>You may not copy, modify, distribute, sell, or lease any part of our Service or included software without our prior written permission.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">7</span>
              Privacy
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>Your privacy is important to us. Our <Link href="/privacy" className="text-[#DC143C] hover:underline">Privacy Policy</Link> explains how we collect, use, and protect your personal information in compliance with the Protection of Personal Information Act 4 of 2013 (POPIA) and other applicable South African laws. By using the Service, you consent to the processing of your personal information as described in the Privacy Policy.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">8</span>
              Subscriptions &amp; Payment Terms
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>Hush offers free and premium (Gold, Platinum) membership tiers. Premium subscriptions are billed in advance on a recurring basis as selected at the time of purchase.</p>
              <p><strong className="text-white">Billing:</strong> You authorise us to charge your chosen payment method at the start of each billing cycle. All amounts are in South African Rand (ZAR) unless otherwise stated and are inclusive of applicable VAT.</p>
              <p><strong className="text-white">Cancellation:</strong> You may cancel your subscription at any time via your account settings. Cancellation takes effect at the end of the current billing period; no partial refunds are provided for unused time.</p>
              <p><strong className="text-white">Refunds:</strong> All sales are final except where required by the Consumer Protection Act 68 of 2008 (CPA) or other applicable South African law.</p>
              <p><strong className="text-white">Price changes:</strong> We reserve the right to change subscription prices with at least 30 days&apos; notice. Your continued use after the price change constitutes acceptance.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">9</span>
              Disclaimer of Warranties
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY SOUTH AFRICAN LAW, HUSH DISCLAIMS ALL WARRANTIES INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
              <p>We do not warrant that the Service will be uninterrupted, error-free, or free from harmful components. We do not guarantee the accuracy or completeness of any content posted by other users.</p>
              <p>Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, or for fraud, or to the extent such exclusion or limitation is not permitted by applicable law.</p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">10</span>
              Limitation of Liability
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HUSH (PTY) LTD SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.</p>
              <p>Our total aggregate liability to you for any claims arising from these Terms or your use of the Service shall not exceed the total amount you paid to Hush in the 12 months immediately preceding the event giving rise to the claim.</p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">11</span>
              Termination
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>We may suspend or terminate your account at any time, with or without notice, for any reason including but not limited to violation of these Terms.</p>
              <p>You may terminate your account at any time by contacting us at <a href="mailto:support@hush.dating" className="text-[#DC143C] hover:underline">support@hush.dating</a> or through the account deletion feature in settings.</p>
              <p>Upon termination, your right to use the Service ceases immediately. Sections that by their nature should survive termination (including Intellectual Property, Disclaimer, Limitation of Liability, and Governing Law) shall survive.</p>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">12</span>
              Governing Law &amp; Dispute Resolution
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>These Terms are governed by and construed in accordance with the laws of the <strong className="text-white">Republic of South Africa</strong>. Any dispute arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of South Africa.</p>
              <p>Before initiating any legal proceedings, the parties agree to attempt to resolve disputes amicably through good-faith negotiation. If negotiations fail within 30 days, either party may refer the dispute to mediation under the rules of the Arbitration Foundation of Southern Africa (AFSA).</p>
              <p>Nothing in this clause prevents Hush from seeking urgent or interim relief from a court of competent jurisdiction.</p>
            </div>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">13</span>
              Changes to These Terms
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page with an updated &quot;Last updated&quot; date and, where appropriate, by email. Your continued use of the Service after such changes constitutes your acceptance of the new Terms.</p>
            </div>
          </section>

          {/* Section 14 — Store */}
          <section id="store-terms" className="scroll-mt-24">
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">14</span>
              {STORE_NAME} store terms
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed sm:pl-11">
              <p>{STORE_NAME} is the Hush online store for adult products. These store terms apply to every order placed in it, in addition to the rest of these Terms.</p>
              <p><strong className="text-white">18+ only.</strong> You may only buy from {STORE_NAME} if you are 18 or older. By placing an order you confirm that you, and the person receiving the parcel, are adults. We may cancel and refund any order we reasonably believe was placed by or for a minor.</p>
              <p><strong className="text-white">Prices and payment.</strong> Prices are in South African rand and include VAT at 15%. Delivery is charged separately at checkout (free above the threshold shown in the store). Payment is processed by PayFast; we never see or store your card details. An order is confirmed only once PayFast confirms the payment. Items are reserved for 30 minutes while you pay; unpaid orders are then cancelled and nothing is charged. If a product is mispriced or becomes unavailable after you pay, we will contact you and refund you in full.</p>
              <p><strong className="text-white">Delivery.</strong> We deliver within South Africa only, by courier, to the address you give. Delivery times are estimates. Risk passes to you on delivery. With discreet packaging (on by default) your parcel ships in a plain outer box with no product names or logos, and the sender is shown as a neutral trading name.</p>
              <p><strong className="text-white">Changing your mind (cooling-off).</strong> Under section 44 of the Electronic Communications and Transactions Act you may cancel an online purchase within 7 days of receiving the goods. Because intimate products cannot be resold once opened, this right applies only to items returned <strong className="text-white">unopened, in their original sealed packaging</strong>. Email us first; you pay the direct cost of sending the item back, and we refund you within 30 days of receiving it.</p>
              <p><strong className="text-white">Defective goods.</strong> Under the Consumer Protection Act (sections 55 and 56) you may return a product that is defective, unsafe or not as described within <strong className="text-white">6 months</strong> of delivery, and choose a repair, replacement or refund. This applies whether or not the product has been opened. Please clean the item before returning it and contact us first so we can arrange collection or a returns address. Damage caused by misuse, or by using the wrong lubricant with a product, is not a defect.</p>
              <p><strong className="text-white">Hygiene.</strong> For health reasons we cannot accept opened or used intimate, personal-care or hygiene products for any reason other than a defect, and we never resell returned items.</p>
              <p><strong className="text-white">Privacy.</strong> We use your order details (name, delivery address, phone and email) only to process, deliver and support your order and to meet our legal record-keeping duties, in line with the Protection of Personal Information Act (POPIA). We share them only with PayFast and the courier, as needed. Your purchases are not shown on your profile, not visible to other members, and never used for third-party marketing. Order notifications show only the order number, never product names. See our <Link href="/privacy" className="text-[#DC143C] hover:underline">Privacy Policy</Link>.</p>
              <p><strong className="text-white">Product use.</strong> Follow the instructions supplied with each product. Products are for adult personal use. If you have a medical condition, check with a healthcare professional first.</p>
              <p>Questions or returns: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#DC143C] hover:underline">{SUPPORT_EMAIL}</a> — please quote your order number.</p>
            </div>
          </section>

          {/* Contact */}
          <div className="glass rounded-2xl p-6 mt-8">
            <h2 className="text-xl font-serif font-bold text-white mb-4">Contact Us</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-gray-300 text-sm">
              <p><span className="text-gray-400">Company:</span> <span className="text-white">Hush (Pty) Ltd</span></p>
              <p><span className="text-gray-400">Email:</span> <a href="mailto:support@hush.dating" className="text-[#DC143C] hover:underline">support@hush.dating</a></p>
              <p><span className="text-gray-400">Country:</span> <span className="text-white">South Africa</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
