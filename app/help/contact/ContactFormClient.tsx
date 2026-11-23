'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Lock, Send } from 'lucide-react'
import { SUPPORT_CATEGORIES, MESSAGE_MAX, MESSAGE_MIN, SUBJECT_MAX, EMAIL_MAX } from '@/lib/support'

export default function ContactFormClient({ memberEmail }: { memberEmail: string | null }) {
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(memberEmail ?? '')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!category) return setError('Please choose a category.')
    if (subject.trim().length < 3) return setError('Please add a short subject.')
    if (message.trim().length < MESSAGE_MIN) return setError('Please tell us a little more so we can help.')
    setBusy(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, message, website, ...(memberEmail ? {} : { email }) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setRef(data.ref)
    } catch {
      setError('We couldn’t reach Unbound. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (ref) {
    return (
      <div className="glass rounded-2xl p-8 text-center border border-emerald-500/20" role="status">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-serif font-bold text-white mb-2">Message sent</h2>
        <p className="text-gray-300 mb-1">
          Your reference is <strong className="text-[#D4AF37] tracking-wider">#{ref}</strong>.
        </p>
        <p className="text-gray-400 text-sm mb-6">
          We&apos;ve emailed a copy to {memberEmail ?? email.trim()} and will reply there, usually within 1 business day.
        </p>
        <Link href="/help" className="inline-block border border-white/15 text-white hover:bg-white/5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          Back to Help Centre
        </Link>
      </div>
    )
  }

  const field = 'input-dark w-full px-4 py-3 rounded-xl text-sm'
  const label = 'block text-white/80 text-sm font-medium mb-2'

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 sm:p-8 space-y-5" noValidate>
      <div>
        <label htmlFor="support-category" className={label}>What do you need help with?</label>
        <select id="support-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field} required>
          <option value="" disabled>Choose a category</option>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-email" className={label}>Your email</label>
        {memberEmail ? (
          <div className="relative">
            <input id="support-email" type="email" value={memberEmail} readOnly aria-describedby="support-email-hint" className={`${field} pr-10 text-white/60 cursor-not-allowed`} />
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" aria-hidden="true" />
          </div>
        ) : (
          <input
            id="support-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={EMAIL_MAX}
            autoComplete="email"
            required
            aria-describedby="support-email-hint"
            className={field}
            placeholder="you@example.com"
          />
        )}
        <p id="support-email-hint" className="text-white/40 text-xs mt-1.5">
          {memberEmail ? 'We’ll reply to the email on your account.' : 'We’ll reply here. If you have an account, use the email you signed up with.'}
        </p>
      </div>

      <div>
        <label htmlFor="support-subject" className={label}>Subject</label>
        <input
          id="support-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={SUBJECT_MAX}
          required
          className={field}
          placeholder="A few words about the problem"
        />
      </div>

      <div>
        <label htmlFor="support-message" className={label}>Message</label>
        <textarea
          id="support-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={7}
          required
          className={`${field} resize-y`}
          placeholder="Tell us what happened. For a member issue, include their username. Please don’t share passwords or card numbers."
        />
        <p className={`text-xs mt-1.5 text-right ${message.length > MESSAGE_MAX - 200 ? 'text-[#D4AF37]' : 'text-white/40'}`}>
          {message.length}/{MESSAGE_MAX}
        </p>
      </div>

      {/* Honeypot: hidden from people and screen readers. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="support-website">Website</label>
        <input id="support-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && <p role="alert" className="text-[#FF8FA3] text-sm">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
      >
        {busy ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" aria-hidden="true" />}
        {busy ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
