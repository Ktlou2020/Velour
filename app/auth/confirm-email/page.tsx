'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { MailCheck, Loader2 } from 'lucide-react'

/**
 * Shown to new members until they click the link in their sign-up email
 * (middleware sends them here when REQUIRE_EMAIL_VERIFICATION is on).
 */
export default function ConfirmEmailPage() {
  const { data: session } = useSession()
  const email = session?.user?.email ?? ''
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function resend() {
    setState('sending')
    setMessage('')
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { alreadyVerified?: boolean; error?: string }
      if (body.alreadyVerified) {
        window.location.href = '/members'
        return
      }
      if (!res.ok) throw new Error(body.error || 'Could not send the email. Please try again shortly.')
      setState('sent')
      setMessage('A new link is on its way. It can take a minute — check your spam folder too.')
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : 'Could not send the email.')
    }
  }

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-serif font-bold text-2xl">U</span>
            </div>
            <span className="text-3xl font-serif font-bold tracking-wide text-white">UNBOUND</span>
          </Link>
        </div>

        <div className="glass rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <MailCheck className="w-16 h-16 text-[#D4AF37]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-white mb-2">Confirm your email</h1>
          <p className="text-gray-300 mb-1">
            We sent a confirmation link to {email ? <span className="text-white font-medium break-all">{email}</span> : 'your email address'}.
          </p>
          <p className="text-gray-400 text-sm mb-6">Click it to unlock Unbound. The link is valid for 24 hours.</p>

          {message && (
            <p role={state === 'error' ? 'alert' : 'status'} className={`text-sm mb-4 ${state === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
              {message}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { window.location.href = '/members' }}
              className="btn-crimson w-full py-3 rounded-xl font-semibold"
            >
              I&apos;ve confirmed — continue
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={state === 'sending'}
              className="w-full py-3 rounded-xl border border-white/15 text-white/80 hover:text-white hover:bg-white/5 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Resend the email
            </button>
          </div>

          <p className="text-gray-500 text-xs mt-6">
            Wrong address? <Link href="/auth/signout" className="text-[#FF6B81] hover:underline">Sign out</Link> and join again with the right one.
          </p>
        </div>
      </div>
    </div>
  )
}
