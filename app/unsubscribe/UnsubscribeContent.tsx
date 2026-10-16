'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';

type Status = 'loading' | 'unsubscribed' | 'resubscribed' | 'error';

export default function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const u = searchParams.get('u') ?? '';
  const t = searchParams.get('t') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const started = useRef(false);

  const update = useCallback(async (resubscribe: boolean) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u, t, resubscribe }),
      });
      if (res.ok) {
        setStatus(resubscribe ? 'resubscribed' : 'unsubscribed');
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [u, t]);

  // One click: opening the link from the email unsubscribes straight away.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!u || !t) {
      setErrorMsg('This link is incomplete. You can manage email settings from your account instead.');
      setStatus('error');
      return;
    }
    void update(false);
  }, [u, t, update]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
            <span className="text-white font-bold text-xl font-serif">U</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-widest font-serif">UNBOUND</span>
        </div>

        <div className="glass rounded-2xl p-8 text-center" aria-live="polite">
          {status === 'loading' && (
            <div className="py-6">
              <div className="w-8 h-8 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white/60 text-sm mt-4">Updating your email preferences…</p>
            </div>
          )}

          {status === 'unsubscribed' && (
            <>
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h1 className="font-serif text-2xl font-bold text-white mb-3">You&apos;re unsubscribed</h1>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                No more emails about likes, messages and tips. We&apos;ll still send essentials like password resets and receipts.
              </p>
              <button
                onClick={() => update(true)}
                disabled={busy}
                className="w-full glass border border-white/15 hover:border-white/30 text-white py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-60"
              >
                {busy ? 'One moment…' : 'Changed your mind? Resubscribe'}
              </button>
            </>
          )}

          {status === 'resubscribed' && (
            <>
              <div className="w-16 h-16 bg-[#DC143C]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={30} className="text-[#DC143C]" />
              </div>
              <h1 className="font-serif text-2xl font-bold text-white mb-3">Welcome back</h1>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                You&apos;ll hear from us when someone likes you or sends a message. You can change this anytime in your account.
              </p>
              <button
                onClick={() => update(false)}
                disabled={busy}
                className="text-white/45 hover:text-white/70 text-sm transition-colors disabled:opacity-60"
              >
                Unsubscribe again
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="font-serif text-2xl font-bold text-white mb-3">Email preferences</h1>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6">
                <p className="text-red-400 text-sm">{errorMsg}</p>
              </div>
              <Link
                href="/account"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white py-3 rounded-xl font-semibold text-sm"
              >
                Manage in account settings
              </Link>
            </>
          )}

          <div className="mt-6">
            <Link href="/members" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
              <ArrowLeft size={12} />
              Back to Unbound
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
