import Link from 'next/link'
import { MessageCircleQuestion } from 'lucide-react'
import { LegalShell } from '@/components/LegalPage'
import { buildFaq } from './faq'
import HelpFaqClient from './HelpFaqClient'

export const metadata = {
  title: 'Help Centre',
  description: 'Answers to common questions about Unbound: getting started, profiles and photos, matching and messaging, safety, membership and your account.',
}

export default function HelpPage() {
  const sections = buildFaq()
  return (
    <LegalShell eyebrow="Support" title="Help Centre">
      <p className="text-gray-400 leading-relaxed max-w-2xl -mt-6">
        Quick answers to the questions we hear most. Search below, or browse by topic.
      </p>

      <HelpFaqClient sections={sections} />

      <div className="glass rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5 border border-[#D4AF37]/20">
        <span className="w-12 h-12 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
          <MessageCircleQuestion className="w-6 h-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-serif font-bold text-white mb-1">Still need help?</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Send us a message and a real person on our team will get back to you, usually within 1 business day.
          </p>
        </div>
        <Link
          href="/help/contact"
          className="inline-block text-center bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all"
        >
          Contact support
        </Link>
      </div>
    </LegalShell>
  )
}
