'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ShieldCheck, Loader2, KeyRound, Copy, Check } from 'lucide-react'

type Status = { enabled: boolean; required: boolean; recoveryLeft: number }

function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/admin') && !raw.startsWith('//') ? raw : '/admin'
}

/**
 * Admin two-step login: set up an authenticator app (first time) or enter
 * the 6-digit code. See lib/admin-mfa.ts.
 */
function AdminVerify() {
  const router = useRouter()
  const params = useSearchParams()
  const { update, status: sessionStatus } = useSession()
  const [status, setStatus] = useState<Status | null>(null)
  const [setup, setSetup] = useState<{ qrSvg: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState<{ codes: string[]; ticket: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const next = safeNext(params.get('next'))

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') { router.replace('/auth/signin'); return }
    if (sessionStatus !== 'authenticated') return
    fetch('/api/admin/2fa', { cache: 'no-store' }).then(async (r) => {
      if (r.status === 403) { router.replace('/members'); return }
      const d = await r.json() as Status
      setStatus(d)
      if (!d.enabled) {
        const s = await fetch('/api/admin/2fa/setup', { method: 'POST' }).then((x) => x.json())
        if (s.qrSvg) setSetup(s)
        else setError(s.error || 'Couldn’t start setup')
      }
    }).catch(() => setError('Couldn’t load — please refresh'))
  }, [sessionStatus, router])

  useEffect(() => { inputRef.current?.focus() }, [status, useBackup])

  async function finish(ticket: string) {
    await update({ mfaTicket: ticket })
    router.replace(next)
    router.refresh()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/admin/2fa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await res.json().catch(() => ({})) as { ticket?: string; recoveryCodes?: string[]; recoveryLeft?: number; error?: string }
      if (!res.ok || !d.ticket) { setError(d.error || 'That didn’t work — try again'); setCode(''); return }
      if (d.recoveryCodes?.length) { setRecovery({ codes: d.recoveryCodes, ticket: d.ticket }); return }
      await finish(d.ticket)
    } catch {
      setError('Something went wrong — please try again')
    } finally {
      setBusy(false)
    }
  }

  const box = 'glass rounded-3xl p-6 sm:p-8 w-full max-w-md'

  if (recovery) {
    return (
      <div className={box}>
        <h1 className="text-white text-xl font-semibold flex items-center gap-2"><KeyRound size={20} className="text-[#D4AF37]" aria-hidden="true" /> Save your backup codes</h1>
        <p className="text-white/65 text-sm mt-2">If you lose your phone, each of these codes lets you in once. Store them somewhere safe, like a password manager. They won&apos;t be shown again.</p>
        <ul className="grid grid-cols-2 gap-2 mt-4 font-mono text-sm text-white" data-testid="backup-codes">
          {recovery.codes.map((c) => <li key={c} className="rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-center">{c}</li>)}
        </ul>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(recovery.codes.join('\n')).then(() => setCopied(true)).catch(() => {}) }}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copied' : 'Copy all'}
        </button>
        <label className="flex items-center gap-2 mt-5 text-sm text-white/80 cursor-pointer">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="accent-[#DC143C] w-4 h-4" />
          I&apos;ve saved these codes
        </label>
        <button type="button" disabled={!saved || busy} onClick={async () => { setBusy(true); await finish(recovery.ticket) }} className="btn-crimson w-full mt-4 py-3 rounded-xl font-semibold disabled:opacity-50">
          {busy ? 'Opening admin…' : 'Continue to admin'}
        </button>
      </div>
    )
  }

  return (
    <div className={box}>
      <h1 className="text-white text-xl font-semibold flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-400" aria-hidden="true" />
        {status && !status.enabled ? 'Set up two-step login' : 'Two-step login'}
      </h1>

      {!status ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/50" aria-label="Loading" /></div>
      ) : !status.enabled ? (
        <>
          <p className="text-white/65 text-sm mt-2">Admin accounts can read members&apos; messages, so they need a second step. Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.</p>
          <ol className="text-white/75 text-sm mt-4 space-y-1.5 list-decimal list-inside">
            <li>Open the app and add an account</li>
            <li>Scan this code (or type the key below)</li>
            <li>Enter the 6-digit code it shows</li>
          </ol>
          {setup ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="w-48 h-48 bg-white rounded-2xl p-2" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
              <p className="text-white/50 text-xs text-center">Key: <span className="font-mono text-white/85 select-all" data-testid="totp-key">{setup.secret}</span></p>
            </div>
          ) : !error && <div className="h-48 mt-4 rounded-2xl skeleton" aria-hidden="true" />}
        </>
      ) : (
        <p className="text-white/65 text-sm mt-2">
          {useBackup ? 'Enter one of your backup codes. Each works once.' : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      )}

      {status && (
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="mfa-code" className="sr-only">{useBackup ? 'Backup code' : '6-digit code'}</label>
          <input
            id="mfa-code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(useBackup ? e.target.value.slice(0, 20) : e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useBackup ? 'xxxx-xxxx' : '123456'}
            className="input-dark w-full px-4 py-3 rounded-xl text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p role="alert" className="text-red-300 text-sm mt-2">{error}</p>}
          <button type="submit" disabled={busy || (useBackup ? code.trim().length < 8 : code.length !== 6)} className="btn-crimson w-full mt-4 py-3 rounded-xl font-semibold disabled:opacity-50">
            {busy ? 'Checking…' : status.enabled ? 'Verify' : 'Turn on two-step login'}
          </button>
          {status.enabled && (
            <button type="button" onClick={() => { setUseBackup((v) => !v); setCode(''); setError('') }} className="w-full mt-3 text-sm text-white/55 hover:text-white">
              {useBackup ? 'Use my authenticator app instead' : 'Lost your phone? Use a backup code'}
            </button>
          )}
        </form>
      )}
    </div>
  )
}

export default function AdminVerifyPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 py-16">
      <Suspense fallback={null}><AdminVerify /></Suspense>
    </main>
  )
}
