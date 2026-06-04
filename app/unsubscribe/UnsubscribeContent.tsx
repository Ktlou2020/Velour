'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';

export default function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleUnsubscribe() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        const data = await res.json() as { error?: string };
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
            <span className="text-white font-bold text-xl font-serif">V</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-widest font-serif">VELOUR</span>
        </div>

        <div className="glass rounded-2xl p-8">
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h1 className="font-serif text-2xl font-bold text-white mb-3">
                Unsubscribed
              </h1>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                You&apos;ve been unsubscribed. You&apos;ll only receive essential account emails going forward.
              </p>
              <Link
                href="/members"
                className="inline-flex items-center gap-2 text-[#DC143C] hover:text-[#FF4D6D] text-sm transition-colors"
              >
                <ArrowLeft size={14} />
                Browse Members
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#DC143C]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail size={24} className="text-[#DC143C]" />
                </div>
                <div>
                  <h1 className="font-serif text-xl font-bold text-white">Email Preferences</h1>
                  <p className="text-white/40 text-sm">Unsubscribe from marketing emails</p>
                </div>
              </div>

              {email && (
                <div className="glass-dark rounded-xl px-4 py-3 mb-6 border border-white/5">
                  <p className="text-white/40 text-xs mb-0.5">Email address</p>
                  <p className="text-white text-sm font-medium truncate">{email}</p>
                </div>
              )}

              <p className="text-white/50 text-sm leading-relaxed mb-6">
                Click below to unsubscribe from all Velour marketing and notification emails.
                You&apos;ll still receive essential account emails such as password resets.
              </p>

              {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-red-400 text-sm">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleUnsubscribe}
                disabled={status === 'loading'}
                className="w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Unsubscribe from all emails'
                )}
              </button>

              <div className="mt-4 text-center">
                <Link
                  href="/members"
                  className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/60 text-sm transition-colors"
                >
                  <ArrowLeft size={12} />
                  Back to Members
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
