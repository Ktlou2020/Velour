'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSubmitted(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
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
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-serif font-bold text-2xl">V</span>
            </div>
            <span className="text-3xl font-serif font-bold tracking-wide text-white">VELOUR</span>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-white mb-2">Forgot Password?</h1>
          <p className="text-gray-400">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {submitted ? (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
              </div>
              <h2 className="text-xl font-serif font-bold text-white mb-3">Check Your Inbox</h2>
              <p className="text-gray-400 mb-6">
                If an account exists for <span className="text-white font-medium">{email}</span>, we&apos;ve sent a password reset link. The link expires in 1 hour.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Don&apos;t see the email? Check your spam folder.
              </p>
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 text-[#DC143C] hover:underline font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#DC143C] text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className="input-dark pl-10"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#DC143C]/20"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
