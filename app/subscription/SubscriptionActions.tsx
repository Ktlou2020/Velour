'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, RotateCcw, XCircle } from 'lucide-react';

/** Cancel / resume / update card for the member's current subscription. */
export default function SubscriptionActions({ canCancel, canResume, canUpdateCard, endsOn }: {
  canCancel: boolean; canResume: boolean; canUpdateCard: boolean; endsOn: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'cancel' | 'resume' | 'card' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(action: 'cancel' | 'resume' | 'manage') {
    const res = await fetch(`/api/subscription/${action}`, { method: 'POST' });
    const d = await res.json().catch(() => ({})) as { error?: string; message?: string; url?: string };
    if (!res.ok) throw new Error(d.error ?? 'Something went wrong — please try again.');
    return d;
  }

  async function cancel() {
    if (!confirm(`Cancel your membership? You won’t be charged again, and you keep your features until ${endsOn}.`)) return;
    setBusy('cancel'); setError(null); setMessage(null);
    try {
      const d = await post('cancel');
      setMessage(d.message ?? 'Your membership won’t renew.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function resume() {
    setBusy('resume'); setError(null); setMessage(null);
    try {
      const d = await post('resume');
      setMessage(d.message ?? 'Your membership is back on.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function updateCard() {
    setBusy('card'); setError(null); setMessage(null);
    try {
      const d = await post('manage');
      if (d.url && /^https:\/\//.test(d.url)) { window.location.assign(d.url); return; }
      throw new Error('We couldn’t open the card page right now — please try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.');
      setBusy(null);
    }
  }

  if (!canCancel && !canResume && !canUpdateCard) return null;

  return (
    <div className="mt-5 pt-5 border-t border-white/10">
      <div className="flex flex-wrap gap-3">
        {canResume && (
          <button type="button" onClick={resume} disabled={!!busy}
            className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50">
            {busy === 'resume' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
            Resume membership
          </button>
        )}
        {canUpdateCard && (
          <button type="button" onClick={updateCard} disabled={!!busy}
            className="glass border border-white/20 hover:border-white/35 text-white/80 hover:text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50">
            {busy === 'card' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CreditCard size={14} aria-hidden="true" />}
            Update card
          </button>
        )}
        {canCancel && (
          <button type="button" onClick={cancel} disabled={!!busy}
            className="glass border border-white/20 hover:border-red-500/30 hover:text-red-400 text-white/60 px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50">
            {busy === 'cancel' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
            Cancel membership
          </button>
        )}
      </div>
      <div aria-live="polite">
        {message && <p role="status" className="text-sm text-emerald-300 mt-3">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-300 mt-3">{error}</p>}
      </div>
    </div>
  );
}
