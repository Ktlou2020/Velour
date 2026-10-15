'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Lock, Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react'

function SigninContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setSuccessMsg('Password updated! Please sign in.')
    } else if (searchParams.get('verified') === '1') {
      setSuccessMsg('Email verified! Welcome to Unbound.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.code === 'rate_limited') {
          setError('Too many attempts, try again in a few minutes.')
        } else if (result.error === 'CredentialsSignin') {
          setError('Incorrect email or password. Please check your details and try again.')
        } else {
          console.error('Sign in failed:', result.error)
          setError('We couldn’t sign you in just now. Please try again in a moment.')
        }
      } else if (!result?.ok) {
        setError('Sign in failed. Please try again.')
      } else {
        router.push('/members')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center px-4">
      {/* Animated floating circles */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#DC143C]/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-800/8 rounded-full blur-3xl" />
        <div
          className="absolute w-48 h-48 rounded-full bg-[#DC143C]/5 blur-2xl"
          style={{ animation: 'floatA 18s ease-in-out infinite', top: '15%', left: '10%' }}
        />
        <div
          className="absolute w-32 h-32 rounded-full bg-[#DC143C]/6 blur-xl"
          style={{ animation: 'floatB 22s ease-in-out infinite', top: '65%', left: '75%' }}
        />
        <div
          className="absolute w-64 h-64 rounded-full bg-[#8F0D25]/5 blur-3xl"
          style={{ animation: 'floatC 26s ease-in-out infinite', top: '40%', left: '55%' }}
        />
      </div>
      <style jsx global>{`
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.97); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(-40px, 30px) scale(1.08); }
          70% { transform: translate(20px, -20px) scale(0.95); }
        }
        @keyframes floatC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, -50px) scale(1.04); }
        }
      `}</style>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" aria-label="Unbound — home" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-serif font-bold text-2xl">U</span>
            </div>
            <span className="text-3xl font-serif font-bold tracking-wide text-white">UNBOUND</span>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Welcome back</h1>
          <p className="text-gray-400">Sign in to pick up where you left off.</p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          {successMsg && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {successMsg}
            </div>
          )}
          {error && (
            <div role="alert" className="mb-5 p-3 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#FF8FA3] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="signin-email" className="block text-sm text-gray-300 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  className="input-dark w-full pl-10"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="signin-password" className="text-sm text-gray-300">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-[#DC143C] hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  className="input-dark w-full pl-10 pr-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-lg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <div
                aria-hidden="true"
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-[#D4AF37] ${remember ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/30'}`}
              >
                {remember && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-400">Remember me for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#DC143C]/20"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

        </div>

        <div className="text-center mt-6 space-y-3">
          <p className="text-gray-400 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-[#DC143C] hover:underline font-medium">Join Unbound Free</Link>
          </p>
          <p className="text-gray-400 text-xs">
            Your details are private and never sold to third parties.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SigninPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#DC143C] animate-spin" /></div>}>
      <SigninContent />
    </Suspense>
  )
}
