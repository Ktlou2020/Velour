'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, Star, Check, MessageCircle } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import PersonAvatar from './PersonAvatar';
import type { EligiblePerson } from './types';

/** Modal listing conversation partners the member can ask for a review. */
export default function RequestPicker({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent?: () => void }) {
  const { showToast } = useToast();
  const [people, setPeople] = useState<EligiblePerson[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setPeople(null);
    fetch('/api/reviews/eligible')
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d: { people?: EligiblePerson[] }) => setPeople(d.people ?? []))
      .catch(() => setPeople([]));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function ask(p: EligiblePerson) {
    setBusy(p.person.id);
    try {
      const res = await fetch('/api/reviews/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: p.person.id }) });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (res.ok) {
        setSent((prev) => new Set(prev).add(p.person.id));
        showToast(`Asked ${p.person.name} for a review`, 'success');
        onSent?.();
      } else showToast(d.error ?? 'Couldn’t send the request', 'error');
    } finally { setBusy(null); }
  }

  if (!open || typeof document === 'undefined') return null;
  // Portal: ancestors with backdrop-filter (.glass) would trap position: fixed.
  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-picker-title"
        className="glass-dark w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 id="request-picker-title" className="text-white font-bold text-lg font-serif">Ask for a review</h2>
            <p className="text-white/60 text-xs mt-0.5">People you&apos;ve chatted with on Unbound. They&apos;ll get a private request.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="text-white/60 hover:text-white p-1 -m-1" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">
          {people === null ? (
            <ul className="space-y-2">{[0, 1, 2].map((i) => <li key={i} className="skeleton h-14 rounded-xl" />)}</ul>
          ) : people.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle size={28} className="text-white/30 mx-auto mb-3" aria-hidden="true" />
              <p className="text-white/75 text-sm font-semibold">No one to ask yet</p>
              <p className="text-white/55 text-xs mt-1 max-w-xs mx-auto">Once you and someone have both sent messages, you can ask them for a review.</p>
              <Link href="/messages" className="inline-block mt-4 text-[#FF4D6D] text-sm font-semibold hover:underline">Go to messages</Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {people.map((p) => {
                const done = sent.has(p.person.id);
                return (
                  <li key={p.person.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <PersonAvatar name={p.person.name} photo={p.person.photo} seed={p.person.username} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-semibold truncate">{p.person.name}</p>
                      <p className="text-white/50 text-xs truncate">@{p.person.username}{p.person.city ? ` · ${p.person.city}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => ask(p)}
                      disabled={done || busy === p.person.id}
                      className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${done ? 'text-emerald-300 bg-emerald-500/10' : 'bg-[#DC143C] hover:bg-[#FF1744] text-white disabled:opacity-50'}`}
                    >
                      {done ? <><Check size={12} aria-hidden="true" /> Asked</> : <><Star size={12} aria-hidden="true" /> Ask</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}
