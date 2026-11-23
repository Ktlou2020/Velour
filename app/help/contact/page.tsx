import { auth } from '@/auth'
import { db } from '@/lib/db'
import { LegalShell, A } from '@/components/LegalPage'
import ContactFormClient from './ContactFormClient'

export const metadata = {
  title: 'Contact support',
  description: 'Send the Unbound support team a message about your account, billing, safety, a bug or feedback.',
}

export const dynamic = 'force-dynamic'

export default async function HelpContactPage() {
  const session = await auth()
  let memberEmail: string | null = null
  if (session?.user?.id) {
    const u = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, isActive: true } }).catch(() => null)
    if (u?.isActive) memberEmail = u.email
  }

  return (
    <LegalShell eyebrow="Support" title="Contact support">
      <p className="text-gray-400 leading-relaxed max-w-2xl -mt-6">
        Tell us what&apos;s going on and a real person will reply by email, usually within 1 business day. You might find a quicker answer in the <A href="/help">Help Centre</A>.
      </p>

      <div className="glass rounded-2xl p-5 border border-[#DC143C]/30 text-sm text-gray-300 leading-relaxed">
        <strong className="text-white">In danger right now?</strong> Call SAPS on <a href="tel:10111" className="text-[#FF4D6D] underline">10111</a>, or <a href="tel:112" className="text-[#FF4D6D] underline">112</a> from a mobile phone. To report a member, use the flag on their profile or the ⋯ menu in your chat — it reaches our moderators fastest.
      </div>

      <ContactFormClient memberEmail={memberEmail} />
    </LegalShell>
  )
}
