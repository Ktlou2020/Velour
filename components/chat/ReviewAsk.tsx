'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, X, Check } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import type { EligiblePerson } from '@/components/reviews/types';

const DISMISS_KEY = 'hush_review_prompt:';

function wasDismissed(convId: string): boolean {
  try { return localStorage.getItem(DISMISS_KEY + convId) === '1'; } catch { return false; }
}
function rememberDismissed(convId: string) {
  try { localStorage.setItem(DISMISS_KEY + convId, '1'); } catch { /* storage unavailable */ }
}

/**
 * Review eligibility for one conversation: who on the other side I can ask
 * for a review, and whether the gentle "Met up?" prompt should show.
 * Re-checks when the message count crosses a multiple of 10.
 */
export function useReviewAsk(conversationId: string | null, messageCount: number) {
  const { showToast } = useToast();
  const [people, setPeople] = useState<EligiblePerson[]>([]);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(true);
  const bucket = Math.floor(messageCount / 10);
  const convRef = useRef(conversationId);
  convRef.current = conversationId;

  useEffect(() => {
    setPeople([]);
    setAsked(new Set());
    setDismissed(conversationId ? wasDismissed(conversationId) : true);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || messageCount < 2) return;
    let cancelled = false;
    fetch(`/api/reviews/eligible?conversationId=${encodeURIComponent(conversationId)}`)
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d: { people?: EligiblePerson[] }) => { if (!cancelled && convRef.current === conversationId) setPeople(d.people ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conversationId, bucket, messageCount >= 2]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = useCallback(async (p: EligiblePerson) => {
    const res = await fetch('/api/reviews/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: p.person.id }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) as { error?: string } : {};
    if (res?.ok) {
      setAsked((prev) => new Set(prev).add(p.person.id));
      showToast(`Asked ${p.person.name} for a review`, 'success');
      if (convRef.current) { rememberDismissed(convRef.current); setDismissed(true); }
    } else showToast((d as { error?: string }).error ?? 'Couldn’t send the request', 'error');
  }, [showToast]);

  const dismiss = useCallback(() => {
    if (convRef.current) rememberDismissed(convRef.current);
    setDismissed(true);
  }, []);

  const askable = people.filter((p) => p.canRequest && !asked.has(p.person.id));
  const promptPerson = !dismissed ? askable.find((p) => p.prompt) ?? null : null;
  return { askable, asked, ask, promptPerson, dismiss };
}

/** Header button (with a tiny menu when a couple is on the other side). */
export function ReviewAskButton({ askable, onAsk }: { askable: EligiblePerson[]; onAsk: (p: EligiblePerson) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (askable.length === 0) return null;
  const single = askable.length === 1;
  return (
    <div ref={wrap} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => (single ? onAsk(askable[0]) : setOpen((v) => !v))}
        className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-[#F5D77A] hover:bg-[#D4AF37]/10 transition-colors text-xs font-semibold"
        aria-label={single ? `Ask ${askable[0].person.name} for a review` : 'Ask for a review'}
        aria-haspopup={single ? undefined : 'menu'}
        aria-expanded={single ? undefined : open}
        title="Ask for a review"
      >
        <Star size={16} aria-hidden="true" />
        <span className="hidden lg:inline">Ask for a review</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-30 glass-dark border border-white/10 rounded-xl p-1 min-w-[12rem] shadow-xl">
          {askable.map((p) => (
            <button key={p.person.id} role="menuitem" type="button" onClick={() => { setOpen(false); onAsk(p); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/85 hover:bg-white/10">
              Ask {p.person.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Gentle, dismissible system-style card at the end of a long conversation. */
export function ReviewPromptCard({ person, onAsk, onDismiss }: { person: EligiblePerson; onAsk: (p: EligiblePerson) => void | Promise<void>; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div role="note" className="relative mx-auto max-w-sm glass rounded-2xl border border-[#D4AF37]/20 px-4 py-3.5 pr-9 text-center">
      <button type="button" onClick={onDismiss} className="absolute top-2 right-2 p-1 text-white/40 hover:text-white/80" aria-label="Dismiss">
        <X size={14} />
      </button>
      <p className="text-white text-sm font-semibold flex items-center justify-center gap-1.5">
        <Star size={14} className="text-[#D4AF37]" aria-hidden="true" /> Met up? Ask {person.person.name} for a review
      </p>
      <p className="text-white/55 text-xs mt-1 leading-relaxed">Reviews help members trust each other. They stay hidden until you&apos;ve both written one.</p>
      <div className="flex justify-center gap-2 mt-3">
        <button type="button" onClick={onDismiss} className="glass px-3 py-1.5 rounded-lg text-white/70 hover:text-white text-xs">Not now</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onAsk(person); } finally { setBusy(false); } }}
          className="bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 disabled:opacity-60"
        >
          <Check size={12} aria-hidden="true" /> Ask for a review
        </button>
      </div>
    </div>
  );
}
