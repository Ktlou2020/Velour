'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'

type Status = 'loading' | 'success' | 'error'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (error) {
      if (error === 'missing' || error === 'invalid') {
        setErrorMsg('This verification link is invalid or has expired.')
      } else {
        setErrorMsg('A server error occurred. Please try again.')
      }
      setStatus('error')
      return
    }

    if (!token) {
      setStatus('error')
      setErrorMsg('No verification token found. Please use the link from your email.')
      return
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      redirect: 'follow',
    })
      .then((res) => {
        if (res.ok || res.redirected) {
          setStatus('success')
        } else {
          setStatus('error')
          setErrorMsg('Verification failed. This link may have already been used or expired.')
        }
      })
      .catch(() => {
        setStatus('error')
        setErrorMsg('A network error occurred. Please try again.')
      })
  }, [searchParams])

  async function handleResend() {
    setResending(true)
    try {
      await fetch('/api/auth/send-verification', { method: 'POST' })
      setResent(true)
    } catch {
      // silent
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center px-4">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#DC143C]/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-800/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-serif font-bold text-2xl">V</span>
            </div>
            <span className="text-3xl font-serif font-bold tracking-wide text-white">VELOUR</span>
          </Link>
        </div>

        <div className="glass rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="w-16 h-16 text-[#DC143C] animate-spin" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-white mb-2">Verifying your email…</h1>
              <p className="text-gray-400">Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-white mb-2">Email Verified!</h1>
              <p className="text-gray-400 mb-6">Welcome to Velour. Your account is now fully activated.</p>
              <Link
                href="/members"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-[#DC143C]/20"
              >
                Explore Members
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="w-16 h-16 text-[#DC143C]" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-white mb-2">Verification Failed</h1>
              <p className="text-gray-400 mb-6">{errorMsg}</p>
              {!resent ? (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-semibold transition-all"
                >
                  {resending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {resending ? 'Sending…' : 'Resend Verification Email'}
                </button>
              ) : (
                <p className="text-emerald-400 font-medium">Verification email sent! Check your inbox.</p>
              )}
              <div className="mt-4">
                <Link href="/members" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                  Go to Members
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#DC143C] animate-spin" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
