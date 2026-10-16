'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Check, User, Users, Circle, Gift } from 'lucide-react'

type AccountType = 'SINGLE' | 'COUPLE'
type Field = 'email' | 'username' | 'password' | 'dateOfBirth' | 'terms'

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ageOn(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null
  const [y, m, d] = dob.split('-').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age
}

function isoDaysAgo(years: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [founding, setFounding] = useState<{ limit: number; left: number } | null>(null)
  useEffect(() => {
    fetch('/api/founding').then((r) => (r.ok ? r.json() : null)).then(setFounding).catch(() => {})
  }, [])
  // Invite code from /i/<code> (which also sets an httpOnly cookie the server reads).
  const [refCode, setRefCode] = useState<string | null>(null)
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? ''
    if (/^[23456789A-HJKMNP-Z]{7}$/.test(r)) setRefCode(r)
  }, [])
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const errorRef = useRef<HTMLDivElement>(null)

  const [accountType, setAccountType] = useState<AccountType>('SINGLE')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [agreed, setAgreed] = useState(false)

  const maxDob = useMemo(() => isoDaysAgo(18), [])
  const policy = [
    { ok: password.length >= 8, label: '8+ characters' },
    { ok: /[A-Za-z]/.test(password), label: 'A letter' },
    { ok: /[0-9]/.test(password), label: 'A number' },
  ]

  function clearField(f: Field) {
    setFieldErrors((prev) => ({ ...prev, [f]: undefined }))
  }

  function validate(): Partial<Record<Field, string>> {
    const errs: Partial<Record<Field, string>> = {}
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Please enter a valid email address'
    if (!USERNAME_RE.test(username.trim())) errs.username = '3–30 characters: letters, numbers, dots, dashes or underscores'
    if (!policy.every((p) => p.ok)) errs.password = 'Use at least 8 characters with a letter and a number'
    const age = ageOn(dateOfBirth)
    if (age === null) errs.dateOfBirth = 'Please enter your date of birth'
    else if (age < 18) errs.dateOfBirth = 'Sorry — you need to be 18 or older to join Unbound'
    else if (age > 120) errs.dateOfBirth = 'Please check your date of birth'
    if (!agreed) errs.terms = 'Please confirm you are 18+ and agree to the Terms'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const errs = validate()
    setFieldErrors(errs)
    const first = (Object.keys(errs) as Field[])[0]
    if (first) {
      document.getElementById(`su-${first}`)?.focus()
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, dateOfBirth, accountType, ...(refCode ? { ref: refCode } : {}) }),
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string }
      if (!res.ok) {
        const msg = data.error ?? 'Registration failed. Please try again.'
        // Put server errors next to the field they belong to where we can.
        if (/email/i.test(msg)) setFieldErrors({ email: msg })
        else if (/username/i.test(msg)) setFieldErrors({ username: msg })
        else if (/password/i.test(msg)) setFieldErrors({ password: msg })
        else if (/18|birth/i.test(msg)) setFieldErrors({ dateOfBirth: msg })
        else { setError(msg); errorRef.current?.focus() }
        return
      }
      const result = await signIn('credentials', { email: email.trim(), password, redirect: false })
      if (result?.error) {
        router.push('/auth/signin?registered=1')
        return
      }
      router.push('/onboarding')
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const errText = (f: Field) =>
    fieldErrors[f] ? <p id={`su-${f}-error`} role="alert" className="text-[#FF8FA3] text-xs mt-1.5">{fieldErrors[f]}</p> : null

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 py-10 sm:py-12">
      <div aria-hidden="true" className="fixed top-20 left-20 w-64 h-64 bg-[#DC143C]/10 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="fixed bottom-20 right-20 w-64 h-64 bg-purple-800/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-7">
          <Link href="/" aria-label="Unbound — home" className="inline-flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold text-xl">U</span>
            </div>
            <span className="text-2xl font-serif font-bold tracking-wide text-white">UNBOUND</span>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Join Unbound</h1>
          <p className="text-gray-400">Free to join. Discreet by design. For singles and couples of every kind.</p>
          {founding && founding.left > 0 && (
            <p className="mt-4 inline-block px-3 py-1.5 rounded-full text-xs border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5D77A]">
              👑 Founding offer: Platinum free forever for the first {founding.limit} women &amp; couples · {founding.left} {founding.left === 1 ? 'spot' : 'spots'} left
            </p>
          )}
          {refCode && (
            <p role="status" className="mt-4 flex items-start justify-center gap-2 text-sm text-[#F5D77A]">
              <Gift size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>You were invited — you&apos;ll both get a week of Gold once you&apos;re set up.</span>
            </p>
          )}
        </div>

        <div className="glass rounded-2xl p-5 sm:p-8">
          {error && (
            <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 p-3 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#FF8FA3] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <fieldset>
              <legend className="block text-sm text-gray-300 mb-2">I&apos;m joining as</legend>
              <div className="grid grid-cols-2 gap-3" role="radiogroup">
                {([
                  { v: 'SINGLE', label: 'Single', sub: 'Just me', Icon: User },
                  { v: 'COUPLE', label: 'A couple', sub: 'Two of us, one profile', Icon: Users },
                ] as const).map(({ v, label, sub, Icon }) => {
                  const on = accountType === v
                  return (
                    <label
                      key={v}
                      className={`relative flex flex-col items-start gap-1 rounded-xl border px-4 py-3 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#D4AF37] ${
                        on ? 'bg-[#DC143C]/15 border-[#DC143C] text-white' : 'border-white/15 text-white/75 hover:border-white/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="accountType"
                        value={v}
                        checked={on}
                        onChange={() => setAccountType(v)}
                        className="sr-only"
                      />
                      <Icon size={18} className={on ? 'text-[#FF4D6D]' : 'text-white/60'} aria-hidden="true" />
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-[11px] text-white/55 leading-tight">{sub}</span>
                      {on && <Check size={14} className="absolute top-3 right-3 text-[#FF4D6D]" aria-hidden="true" />}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="su-email" className="block text-sm text-gray-300 mb-1.5">Email address</label>
              <input
                type="email"
                id="su-email"
                inputMode="email"
                placeholder="you@example.com"
                className="input-dark w-full"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearField('email') }}
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'su-email-error' : undefined}
                disabled={loading}
              />
              {errText('email')}
            </div>

            <div>
              <label htmlFor="su-username" className="block text-sm text-gray-300 mb-1.5">Username</label>
              <input
                type="text"
                id="su-username"
                placeholder={accountType === 'COUPLE' ? 'e.g. sundowners_for_two' : 'e.g. jazz_and_sundowners'}
                className="input-dark w-full"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearField('username') }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!fieldErrors.username}
                aria-describedby={`su-username-hint${fieldErrors.username ? ' su-username-error' : ''}`}
                disabled={loading}
              />
              <p id="su-username-hint" className="text-xs text-gray-400 mt-1.5">Shown to other members. Avoid using your real full name.</p>
              {errText('username')}
            </div>

            <div>
              <label htmlFor="su-password" className="block text-sm text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="su-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-dark w-full pr-12"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearField('password') }}
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={`su-password-policy${fieldErrors.password ? ' su-password-error' : ''}`}
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
              <ul id="su-password-policy" className="flex flex-wrap gap-x-4 gap-y-1 mt-2" aria-label="Password requirements">
                {policy.map((p) => (
                  <li key={p.label} className={`flex items-center gap-1.5 text-xs ${p.ok ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {p.ok ? <Check size={12} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
                    {p.label}
                    <span className="sr-only">{p.ok ? '(done)' : '(needed)'}</span>
                  </li>
                ))}
              </ul>
              {errText('password')}
            </div>

            <div>
              <label htmlFor="su-dateOfBirth" className="block text-sm text-gray-300 mb-1.5">
                {accountType === 'COUPLE' ? 'Your date of birth' : 'Date of birth'}
              </label>
              <input
                id="su-dateOfBirth"
                type="date"
                max={maxDob}
                min="1900-01-01"
                className="input-dark w-full [color-scheme:dark]"
                value={dateOfBirth}
                onChange={(e) => { setDateOfBirth(e.target.value); clearField('dateOfBirth') }}
                onBlur={() => {
                  const a = ageOn(dateOfBirth)
                  if (a !== null && a < 18) setFieldErrors((p) => ({ ...p, dateOfBirth: 'Sorry — you need to be 18 or older to join Unbound' }))
                }}
                autoComplete="bday"
                aria-invalid={!!fieldErrors.dateOfBirth}
                aria-describedby={`su-dob-hint${fieldErrors.dateOfBirth ? ' su-dateOfBirth-error' : ''}`}
                disabled={loading}
              />
              <p id="su-dob-hint" className="text-xs text-gray-400 mt-1.5">
                We show your age, never your birthday.{accountType === 'COUPLE' ? " You'll add your partner's details next." : ''}
              </p>
              {errText('dateOfBirth')}
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  id="su-terms"
                  type="checkbox"
                  className="sr-only peer"
                  checked={agreed}
                  onChange={(e) => { setAgreed(e.target.checked); clearField('terms') }}
                  aria-invalid={!!fieldErrors.terms}
                  aria-describedby={fieldErrors.terms ? 'su-terms-error' : undefined}
                />
                <div
                  aria-hidden="true"
                  className={`w-5 h-5 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-[#D4AF37] ${agreed ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/30'}`}
                >
                  {agreed && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-400 leading-relaxed">
                  {accountType === 'COUPLE' ? 'We are both' : 'I am'} at least <span className="text-white font-semibold">18 years old</span> and agree to the{' '}
                  <Link href="/terms" className="text-[#FF4D6D] hover:underline">Terms</Link> and{' '}
                  <Link href="/privacy" className="text-[#FF4D6D] hover:underline">Privacy Policy</Link>
                </span>
              </label>
              {errText('terms')}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all mt-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  <span>Creating your account…</span>
                </>
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
