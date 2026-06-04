'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Eye, EyeOff, ArrowRight, XCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json() as { success?: boolean; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Failed to reset password. Please try again.')
        return
      }

      router.push('/auth/signin?reset=1')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen animated-gradient flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8 text-center">
            <XCircle className="w-16 h-16 text-[#DC143C] mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-gray-400 mb-6">This password reset link is missing or invalid.</p>
            <Link href="/auth/forgot-password" className="text-[#DC143C] hover:underline font-medium">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-serif font-bold text-white mb-2">Choose a New Password</h1>
          <p className="text-gray-400">Make it strong and memorable</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#DC143C] text-sm">
              {error}
              {error.includes('expired') && (
                <div className="mt-2">
                  <Link href="/auth/forgot-password" className="underline font-medium">
                    Request a new link
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  className="input-dark pl-10 pr-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  placeholder="Repeat your new password"
                  className="input-dark pl-10"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#DC143C]/20"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Reset Password <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
