import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy — Velour',
  description: 'Privacy Policy for Velour, compliant with POPIA (South Africa).',
}

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-serif font-bold text-white mt-4 mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: {lastUpdated} · Compliant with POPIA (Act 4 of 2013)</p>
        </div>

        <div className="space-y-8">
          {/* Intro */}
          <div className="glass rounded-2xl p-6">
            <p className="text-gray-300 leading-relaxed">
              Velour (Pty) Ltd (&quot;Velour&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, share, and protect your personal information in accordance with the <strong className="text-white">Protection of Personal Information Act 4 of 2013</strong> (POPIA) and other applicable South African laws.
            </p>
            <p className="text-gray-300 leading-relaxed mt-3">
              By using the Velour platform, you consent to the processing of your personal information as described in this policy. If you do not agree, please do not use the Service.
            </p>
          </div>

          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">1</span>
              Information We Collect
            </h2>
            <div className="space-y-4 text-gray-300 leading-relaxed pl-11">
              <div>
                <h3 className="text-white font-semibold mb-2">1.1 Information you provide directly</h3>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>Account information: username, email address, password (stored as a one-way hash)</li>
                  <li>Profile information: display name, date of birth, gender, orientation, relationship status, bio, location (city/country)</li>
                  <li>Photos and media you upload</li>
                  <li>Messages and communications you send through the platform</li>
                  <li>Payment information (processed by our payment provider — we do not store full card numbers)</li>
                  <li>Forum posts, event registrations, and other community contributions</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">1.2 Information collected automatically</h3>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>Log data: IP address, browser type, pages visited, timestamps</li>
                  <li>Device information: operating system, device type, unique device identifiers</li>
                  <li>Usage data: features used, matches made, messages sent, session duration</li>
                  <li>Cookie and tracking data (see Section 8)</li>
                  <li>Online status and last-seen timestamps</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">1.3 Special categories of personal information</h3>
                <p>
                  Velour processes special categories of personal information under POPIA, specifically information relating to sexual orientation and relationship preferences. We process this information because you have explicitly provided it for the purpose of using a lifestyle dating platform, and we rely on your explicit consent as the lawful basis for this processing.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">2</span>
              How We Use Your Information
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We use your personal information to:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-4">
                <li>Create and manage your account</li>
                <li>Provide matching, messaging, and community features</li>
                <li>Verify your age and identity</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send you transactional emails (account verification, password resets, billing notifications)</li>
                <li>Send marketing communications where you have opted in</li>
                <li>Improve and personalise the Service through analytics</li>
                <li>Detect, investigate, and prevent fraud, abuse, and security incidents</li>
                <li>Comply with our legal obligations under South African law</li>
                <li>Resolve disputes and enforce our Terms of Service</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">3</span>
              Sharing with Third Parties
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We do not sell your personal information. We may share your personal information with:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-4">
                <li><strong className="text-white">Service providers:</strong> Third-party companies that help us operate the Service (hosting, email delivery, payment processing, analytics). These providers are bound by contractual obligations to protect your information and may only use it as instructed by us.</li>
                <li><strong className="text-white">Other members:</strong> Profile information you make public (photos, bio, interests, online status) is visible to other registered members.</li>
                <li><strong className="text-white">Legal authorities:</strong> Where required by law, court order, or to protect the rights, property, or safety of Velour, our members, or the public.</li>
                <li><strong className="text-white">Business transfers:</strong> In the event of a merger, acquisition, or sale of all or part of our business, your information may be transferred to the acquiring entity subject to equivalent privacy protections.</li>
              </ul>
              <p className="mt-2">Where we transfer personal information outside South Africa, we take appropriate safeguards to ensure adequate protection as required by POPIA.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">4</span>
              Data Retention
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We retain your personal information for as long as your account is active or as needed to provide the Service. Specifically:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-4">
                <li><strong className="text-white">Account data:</strong> Retained for the duration of your account plus up to 90 days after deletion, to allow account recovery and resolve any outstanding disputes.</li>
                <li><strong className="text-white">Messages:</strong> Retained for 12 months after your account is deleted, then permanently erased.</li>
                <li><strong className="text-white">Payment records:</strong> Retained for 5 years as required by South African tax law.</li>
                <li><strong className="text-white">Log and security data:</strong> Retained for up to 12 months.</li>
              </ul>
              <p className="mt-2">When we no longer need your personal information, we securely delete or anonymise it.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">5</span>
              Your Rights Under POPIA
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>Under the Protection of Personal Information Act 4 of 2013, you have the following rights:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-4">
                <li><strong className="text-white">Right to access:</strong> You may request a copy of the personal information we hold about you.</li>
                <li><strong className="text-white">Right to correction:</strong> You may request that we correct inaccurate or incomplete personal information.</li>
                <li><strong className="text-white">Right to deletion:</strong> You may request that we delete your personal information, subject to legal retention requirements.</li>
                <li><strong className="text-white">Right to object:</strong> You may object to the processing of your personal information in certain circumstances.</li>
                <li><strong className="text-white">Right to withdraw consent:</strong> Where processing is based on consent, you may withdraw that consent at any time (without affecting the lawfulness of prior processing).</li>
                <li><strong className="text-white">Right to complain:</strong> You have the right to lodge a complaint with the Information Regulator of South Africa.</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact our Information Officer at{' '}
                <a href="mailto:privacy@velour.dating" className="text-[#DC143C] hover:underline">privacy@velour.dating</a>.
                We will respond within 30 days.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">6</span>
              Data Security
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We implement appropriate technical and organisational security measures to protect your personal information against unauthorised access, disclosure, alteration, or destruction. These measures include:</p>
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Encryption of passwords using bcrypt hashing</li>
                <li>TLS/HTTPS encryption for all data in transit</li>
                <li>Encryption of data at rest on our database servers</li>
                <li>Role-based access controls limiting who can access personal data</li>
                <li>Regular security assessments and audits</li>
              </ul>
              <p className="mt-2">While we strive to protect your personal information, no method of transmission over the internet is 100% secure. In the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify you and the Information Regulator as required by POPIA.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">7</span>
              Children&apos;s Privacy
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>The Service is strictly for adults aged 18 and over. We do not knowingly collect personal information from persons under 18. If we become aware that we have inadvertently collected personal information from a minor, we will take immediate steps to delete it and terminate the associated account.</p>
              <p>If you believe a minor has created an account on Velour, please contact us at <a href="mailto:support@velour.dating" className="text-[#DC143C] hover:underline">support@velour.dating</a> immediately.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">8</span>
              Cookies &amp; Tracking Technologies
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We use cookies and similar technologies to operate and improve the Service. Cookies are small text files stored on your device.</p>
              <div className="space-y-2">
                <p><strong className="text-white">Essential cookies:</strong> Necessary for the Service to function (session management, authentication). These cannot be disabled.</p>
                <p><strong className="text-white">Analytics cookies:</strong> Help us understand how you use the Service so we can improve it. These are only set if you accept our cookie banner.</p>
                <p><strong className="text-white">Preference cookies:</strong> Remember your settings and preferences (e.g., age verification confirmation).</p>
              </div>
              <p className="mt-2">You can manage cookie preferences through our cookie banner or your browser settings. Note that disabling certain cookies may affect the functionality of the Service.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">9</span>
              Changes to This Policy
            </h2>
            <div className="space-y-3 text-gray-300 leading-relaxed pl-11">
              <p>We may update this Privacy Policy from time to time. We will notify you of material changes by updating the &quot;Last updated&quot; date and, where required by POPIA, by notifying you directly. Your continued use of the Service after any changes constitutes your acceptance of the updated policy.</p>
            </div>
          </section>

          {/* Contact / Information Officer */}
          <div className="glass rounded-2xl p-6 mt-8">
            <h2 className="text-xl font-serif font-bold text-white mb-4">Information Officer &amp; Contact Details</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Our Information Officer is responsible for ensuring compliance with POPIA and handling privacy-related enquiries and complaints.
            </p>
            <div className="space-y-2 text-gray-300 text-sm">
              <p><span className="text-gray-500">Company:</span> <span className="text-white">Velour (Pty) Ltd</span></p>
              <p><span className="text-gray-500">Information Officer email:</span> <a href="mailto:privacy@velour.dating" className="text-[#DC143C] hover:underline">privacy@velour.dating</a></p>
              <p><span className="text-gray-500">General support:</span> <a href="mailto:support@velour.dating" className="text-[#DC143C] hover:underline">support@velour.dating</a></p>
              <p><span className="text-gray-500">Country:</span> <span className="text-white">South Africa</span></p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-gray-500 text-sm">
                <strong className="text-gray-400">Information Regulator (South Africa):</strong><br />
                JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001<br />
                <a href="https://www.justice.gov.za/inforeg/" className="text-[#DC143C] hover:underline" target="_blank" rel="noopener noreferrer">www.justice.gov.za/inforeg/</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
