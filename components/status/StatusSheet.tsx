'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import {
  STATUS_DURATIONS, STATUS_EMOJIS, STATUS_PRESETS, STATUS_TEXT_MAX,
  type ActiveStatus, type StatusDuration,
} from './status';

interface Props {
  open: boolean;
  current: ActiveStatus | null;
  onClose: () => void;
  onSaved: (status: ActiveStatus | null) => void;
}

/** Bottom sheet (mobile) / dialog (desktop) for setting or clearing your status. */
export default function StatusSheet({ open, current, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [emoji, setEmoji] = useState<string>(current?.emoji ?? '🍷');
  const [text, setText] = useState(current?.text ?? '');
  const [duration, setDuration] = useState<StatusDuration>('tonight');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset the form each time the sheet opens; Escape closes it.
  useEffect(() => {
    if (!open) return;
    setEmoji(current?.emoji ?? '🍷');
    setText(current?.text ?? '');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || typeof document === 'undefined') return null;

  async function save(status: { emoji: string; text: string; duration: StatusDuration } | null) {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; profile?: { statusText?: string | null; statusEmoji?: string | null; statusUntil?: string | null } };
      if (!res.ok) { showToast(data.error ?? 'Could not save your status', 'error'); return; }
      const p = data.profile;
      onSaved(p?.statusText && p.statusUntil ? { emoji: p.statusEmoji ?? null, text: p.statusText, until: p.statusUntil } : null);
      showToast(status ? 'Status set' : 'Status cleared', 'success');
      onClose();
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  const trimmed = text.trim();

  // Portalled to <body> so page transitions / stacking contexts can't trap it under the tab bar.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-sheet-title"
        className="glass-dark w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex items-center justify-between mb-1">
          <h2 id="status-sheet-title" className="font-serif text-xl font-bold text-white">Set your status</h2>
          <button onClick={onClose} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-white/60 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-white/60 text-sm mb-5">A little hint of what you&apos;re up for. It disappears on its own.</p>

        <p className="eyebrow text-white/50 mb-2">Quick picks</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUS_PRESETS.map((p) => {
            const selected = p.text === trimmed && p.emoji === emoji;
            return (
              <button
                key={p.text}
                type="button"
                onClick={() => { setEmoji(p.emoji); setText(p.text); }}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${selected ? 'border-[#D4AF37]/70 bg-[#D4AF37]/15 text-[#F3E3A6]' : 'border-white/10 text-white/75 hover:border-white/25 hover:text-white'}`}
              >
                <span aria-hidden="true" className="mr-1">{p.emoji}</span>{p.text}
              </button>
            );
          })}
        </div>

        <p className="eyebrow text-white/50 mb-2">Or write your own</p>
        <div className="flex gap-2 mb-2">
          <div className="input-dark !px-0 w-12 flex items-center justify-center text-xl flex-shrink-0" aria-hidden="true">{emoji}</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, STATUS_TEXT_MAX))}
            maxLength={STATUS_TEXT_MAX}
            placeholder="e.g. Sundowners anyone?"
            aria-label="Status text"
            className="input-dark flex-1 min-w-0"
          />
        </div>
        <p className="text-white/45 text-xs text-right mb-3">{text.length}/{STATUS_TEXT_MAX}</p>
        <div className="flex flex-wrap gap-1.5 mb-5" role="group" aria-label="Emoji">
          {STATUS_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              aria-label={`Use ${e}`}
              className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-colors ${emoji === e ? 'bg-[#DC143C]/20 border border-[#DC143C]/50' : 'hover:bg-white/5 border border-transparent'}`}
            >
              {e}
            </button>
          ))}
        </div>

        <p className="eyebrow text-white/50 mb-2">Show it for</p>
        <div className="grid grid-cols-3 gap-2 mb-6" role="radiogroup" aria-label="Duration">
          {STATUS_DURATIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={duration === d.value}
              onClick={() => setDuration(d.value)}
              className={`py-2 rounded-xl text-sm border transition-colors ${duration === d.value ? 'border-[#DC143C]/60 bg-[#DC143C]/15 text-white' : 'border-white/10 text-white/65 hover:text-white'}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          {current && (
            <button
              type="button"
              onClick={() => save(null)}
              disabled={saving}
              className="glass px-4 py-3 rounded-xl text-sm text-white/70 hover:text-white disabled:opacity-50"
            >
              Clear status
            </button>
          )}
          <button
            type="button"
            onClick={() => save({ emoji, text: trimmed, duration })}
            disabled={saving || !trimmed}
            className="flex-1 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving…' : 'Share status'}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
