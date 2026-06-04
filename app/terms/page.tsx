import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service — Velour',
  description: 'Terms of Service for the Velour lifestyle dating community.',
}

export default function TermsPage() {
  const lastUpdated = '1 June 2025'

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Velour</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold text-sm">V</span>
            </div>
            <span className="font-serif font-bold tracking-wide text-white">VELOUR</span>
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
          <p className="text-gray-500 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Intro */}
          <div className="glass rounded-2xl p-6">
            <p className="text-gray-300 leading-relaxed">
              Welcome to Velour. These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Velour platform, including our website, mobile application, and all related services (collectively, the &quot;Service&quot;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.
            </p>
            <p className="text-gray-300 leading-relaxed mt-3">
              Velour is operated by Velour (Pty) Ltd, a company incorporated in South Africa. Our registered address and contact information are listed at the end of this document.
            </p>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">1</span>
              Eligibility
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>You must be at least <strong className="text-white">18 years of age</strong> to register for or use the Service. By creating an account, you represent and warrant that you are 18 or older and that all information you provide is accurate, current, and complete.</p>
              <p>The Service is intended for adults seeking lifestyle connections, companionship, and dating. It is not intended for minors under any circumstances. Velour reserves the right to terminate any account we have reason to believe belongs to a minor, without notice.</p>
              <p>By using the Service, you also represent that you are not prohibited from using online services under the laws of South Africa or any other applicable jurisdiction.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">2</span>
              Account Registration
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>To access most features of the Service, you must register for an account. You agree to provide accurate, complete, and up-to-date information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.</p>
              <p>You may only maintain one account. Creating multiple accounts to circumvent bans, restrictions, or subscription limits is prohibited and will result in permanent termination of all accounts.</p>
              <p>You must notify us immediately at <a href="mailto:support@velour.dating" className="text-[#DC143C] hover:underline">support@velour.dating</a> if you suspect unauthorised use of your account.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">3</span>
              Acceptable Use
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
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
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
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
                <li>Use the Service in any way that violates South African law or any other applicable law</li>
              </ul>
              <p className="mt-3">Violation of these prohibitions may result in immediate account termination and may be reported to law enforcement authorities.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">5</span>
              User Content
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>You retain ownership of the content you post (&quot;User Content&quot;). By submitting User Content to the Service, you grant Velour a non-exclusive, worldwide, royalty-free, sublicensable licence to use, reproduce, modify, display, and distribute that content solely for the purpose of operating and improving the Service.</p>
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
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>The Service and all its original content (excluding User Content), features, and functionality are and shall remain the exclusive property of Velour (Pty) Ltd and its licensors. The Velour name, logo, and all related marks are trademarks of Velour (Pty) Ltd.</p>
              <p>You may not copy, modify, distribute, sell, or lease any part of our Service or included software without our prior written permission.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">7</span>
              Privacy
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>Your privacy is important to us. Our <Link href="/privacy" className="text-[#DC143C] hover:underline">Privacy Policy</Link> explains how we collect, use, and protect your personal information in compliance with the Protection of Personal Information Act 4 of 2013 (POPIA) and other applicable South African laws. By using the Service, you consent to the processing of your personal information as described in the Privacy Policy.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">8</span>
              Subscriptions &amp; Payment Terms
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>Velour offers free and premium (Gold, Platinum) membership tiers. Premium subscriptions are billed in advance on a recurring basis as selected at the time of purchase.</p>
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
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY SOUTH AFRICAN LAW, VELOUR DISCLAIMS ALL WARRANTIES INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
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
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VELOUR (PTY) LTD SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.</p>
              <p>Our total aggregate liability to you for any claims arising from these Terms or your use of the Service shall not exceed the total amount you paid to Velour in the 12 months immediately preceding the event giving rise to the claim.</p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">11</span>
              Termination
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We may suspend or terminate your account at any time, with or without notice, for any reason including but not limited to violation of these Terms.</p>
              <p>You may terminate your account at any time by contacting us at <a href="mailto:support@velour.dating" className="text-[#DC143C] hover:underline">support@velour.dating</a> or through the account deletion feature in settings.</p>
              <p>Upon termination, your right to use the Service ceases immediately. Sections that by their nature should survive termination (including Intellectual Property, Disclaimer, Limitation of Liability, and Governing Law) shall survive.</p>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">12</span>
              Governing Law &amp; Dispute Resolution
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>These Terms are governed by and construed in accordance with the laws of the <strong className="text-white">Republic of South Africa</strong>. Any dispute arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of South Africa.</p>
              <p>Before initiating any legal proceedings, the parties agree to attempt to resolve disputes amicably through good-faith negotiation. If negotiations fail within 30 days, either party may refer the dispute to mediation under the rules of the Arbitration Foundation of Southern Africa (AFSA).</p>
              <p>Nothing in this clause prevents Velour from seeking urgent or interim relief from a court of competent jurisdiction.</p>
            </div>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">13</span>
              Changes to These Terms
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page with an updated &quot;Last updated&quot; date and, where appropriate, by email. Your continued use of the Service after such changes constitutes your acceptance of the new Terms.</p>
            </div>
          </section>

          {/* Contact */}
          <div className="glass rounded-2xl p-6 mt-8">
            <h2 className="text-xl font-serif font-bold text-white mb-4">Contact Us</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-gray-300 text-sm">
              <p><span className="text-gray-500">Company:</span> <span className="text-white">Velour (Pty) Ltd</span></p>
              <p><span className="text-gray-500">Email:</span> <a href="mailto:support@velour.dating" className="text-[#DC143C] hover:underline">support@velour.dating</a></p>
              <p><span className="text-gray-500">Country:</span> <span className="text-white">South Africa</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
