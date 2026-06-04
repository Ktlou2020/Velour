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
      setSuccessMsg('Email verified! Welcome to Velour.')
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
        // Show specific error for debugging
        if (result.error === 'CredentialsSignin') {
          setError('Incorrect email or password. Please check your details and try again.')
        } else {
          setError(`Sign in failed: ${result.error}. Check that NEXTAUTH_SECRET is set in Railway.`)
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
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-serif font-bold text-2xl">V</span>
            </div>
            <span className="text-3xl font-serif font-bold tracking-wide text-white">VELOUR</span>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-white mb-2">Welcome back</h1>
          <p className="text-gray-400">Sign in to your account to continue</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {successMsg && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {successMsg}
            </div>
          )}
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
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-gray-300">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-[#DC143C] hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  className="input-dark pl-10 pr-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${remember ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/20'}`}
                onClick={() => setRemember(!remember)}
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500">
              <span className="px-3 bg-[#12121A]">or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button disabled className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 text-gray-400 text-sm opacity-50 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button disabled className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 text-gray-400 text-sm opacity-50 cursor-not-allowed">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>
        </div>

        <div className="text-center mt-6 space-y-3">
          <p className="text-gray-400 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-[#DC143C] hover:underline font-medium">Join Velour Free</Link>
          </p>
          <p className="text-gray-600 text-xs">
            🔒 Your data is encrypted and never shared with third parties
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
