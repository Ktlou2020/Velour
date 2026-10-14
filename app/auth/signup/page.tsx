'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Check } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username.trim()) return setError('Username is required')
    if (!email.trim()) return setError('Email is required')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirmPassword) return setError('Passwords do not match')
    if (!dateOfBirth) return setError('Date of birth is required')
    if (!ageConfirmed) return setError('You must confirm you are at least 18 years old')

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, dateOfBirth }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.')
        return
      }
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Account created! Please sign in manually.')
        router.push('/auth/signin')
        return
      }
      router.push('/onboarding')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 py-12">
      <div aria-hidden="true" className="fixed top-20 left-20 w-64 h-64 bg-[#DC143C]/10 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="fixed bottom-20 right-20 w-64 h-64 bg-purple-800/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" aria-label="Hush — home" className="inline-flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold text-xl">H</span>
            </div>
            <span className="text-2xl font-serif font-bold tracking-wide text-white">HUSH</span>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Join Hush</h1>
          <p className="text-gray-400">Free to join. Discreet by design. For singles and couples.</p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          {error && (
            <div role="alert" className="mb-5 p-3 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#FF8FA3] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="su-username" className="block text-sm text-gray-300 mb-1.5">Username</label>
              <input
                type="text"
                id="su-username"
                placeholder="e.g. jazz_and_sundowners"
                aria-describedby="su-username-hint"
                className="input-dark w-full"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
              <p id="su-username-hint" className="text-xs text-gray-400 mt-1.5">Shown to other members. Avoid using your real full name.</p>
            </div>

            <div>
              <label htmlFor="su-email" className="block text-sm text-gray-300 mb-1.5">Email address</label>
              <input
                type="email"
                id="su-email"
                placeholder="you@example.com"
                className="input-dark w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="su-password" className="block text-sm text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="su-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  className="input-dark w-full pr-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white rounded-lg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="su-confirm" className="block text-sm text-gray-300 mb-1.5">Confirm password</label>
              <input
                type="password"
                id="su-confirm"
                placeholder="Repeat your password"
                className="input-dark w-full"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="su-dob" className="block text-sm text-gray-300 mb-1.5">Date of birth</label>
              <input
                id="su-dob"
                type="date"
                className="input-dark w-full [color-scheme:dark]"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                disabled={loading}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
              />
              <div
                aria-hidden="true"
                className={`w-5 h-5 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-[#D4AF37] ${ageConfirmed ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/30'}`}
              >
                {ageConfirmed && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-gray-400 leading-relaxed">
                I confirm I am at least <span className="text-white font-semibold">18 years of age</span> and agree to the{' '}
                <Link href="/terms" className="text-[#FF4D6D] hover:underline">Terms</Link> and{' '}
                <Link href="/privacy" className="text-[#FF4D6D] hover:underline">Privacy Policy</Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all mt-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Create my free account'}
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-6">
            Already a member?{' '}
            <Link href="/auth/signin" className="text-[#DC143C] hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
