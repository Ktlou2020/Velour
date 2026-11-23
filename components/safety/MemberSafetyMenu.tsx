'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, HeartOff, Ban, Flag, X } from 'lucide-react';

export const REPORT_REASONS = [
  'Fake profile / Catfishing',
  'Inappropriate content',
  'Shared my photos/videos outside Unbound',
  'Harassment or abuse',
  'Spam or scam',
  'Underage user',
  'Other',
];

type Action = 'unmatch' | 'block' | 'report';

/**
 * "⋯" menu for one member: Unmatch (when you're matched or chatting), Block and
 * Report. Confirms before unmatching or blocking; `onDone` runs after success.
 */
export default function MemberSafetyMenu({
  userId, username, name, canUnmatch = true, onDone, className = '', openUp = false,
}: {
  userId: string;
  username: string;
  name: string;
  canUnmatch?: boolean;
  onDone?: (action: Action) => void;
  className?: string;
  /** Open the menu above the button (e.g. at the bottom of a card). */
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  function start(a: Action) {
    setOpen(false);
    setError('');
    setReason('');
    setNote('');
    setReported(false);
    setDialog(a);
  }

  async function confirm() {
    if (!dialog) return;
    setBusy(true);
    setError('');
    try {
      const res = dialog === 'unmatch'
        ? await fetch('/api/unmatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
        : dialog === 'block'
          ? await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
          : await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUsername: username, reason, note }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error || 'Something went wrong — please try again');
        return;
      }
      if (dialog === 'report') { setReported(true); onDone?.('report'); return; }
      const done = dialog;
      setDialog(null);
      onDone?.(done);
    } catch {
      setError('Something went wrong — please try again');
    } finally {
      setBusy(false);
    }
  }

  const item = 'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors';

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        aria-label={`More options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div role="menu" className={`absolute right-0 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 glass-dark rounded-xl border border-white/10 py-1.5 shadow-xl z-50`}>
          {canUnmatch && (
            <button role="menuitem" type="button" onClick={() => start('unmatch')} className={`${item} text-white/80 hover:bg-white/5`}>
              <HeartOff size={15} /> Unmatch
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => start('block')} className={`${item} text-white/80 hover:bg-white/5`}>
            <Ban size={15} /> Block
          </button>
          <button role="menuitem" type="button" onClick={() => start('report')} className={`${item} text-red-300 hover:bg-red-500/10`}>
            <Flag size={15} /> Report
          </button>
        </div>
      )}

      {/* Portalled to <body>: headers with backdrop blur would otherwise trap a fixed overlay. */}
      {dialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="safety-title" onClick={(e) => e.stopPropagation()}>
          <div className="glass-dark rounded-2xl p-6 w-full max-w-sm border border-white/10 text-left">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 id="safety-title" className="text-white font-semibold">
                {dialog === 'unmatch' ? `Unmatch ${name}?` : dialog === 'block' ? `Block ${name}?` : `Report ${name}`}
              </h2>
              <button type="button" onClick={() => setDialog(null)} aria-label="Close" className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>

            {dialog === 'unmatch' && (
              <p className="text-white/65 text-sm">Your match and chat end for both of you, and you won&apos;t be able to message each other again. They aren&apos;t told you unmatched.</p>
            )}
            {dialog === 'block' && (
              <p className="text-white/65 text-sm">They won&apos;t be able to see your profile or message you, and any match or chat between you ends. They aren&apos;t told.</p>
            )}
            {dialog === 'report' && (reported ? (
              <p className="text-emerald-300 text-sm">Thanks — our team will review this. You can also block {name} so they can&apos;t contact you.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-white/65 text-sm">Reports are confidential — {name} won&apos;t know it was you.</p>
                <div className="space-y-1.5" role="radiogroup" aria-label="Reason">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${reason === r ? 'border-red-400/60 bg-red-500/10 text-white' : 'border-white/10 text-white/75 hover:border-white/20'}`}>
                      <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#DC143C]" />
                      {r}
                    </label>
                  ))}
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={3} placeholder="Anything else we should know? (optional)" aria-label="Details" className="input-dark w-full px-3 py-2 rounded-xl text-sm resize-none" />
              </div>
            ))}

            {error && <p role="alert" className="text-red-300 text-xs mt-3">{error}</p>}

            <div className="flex justify-end gap-2 mt-5">
              {dialog === 'report' && reported ? (
                <>
                  <button type="button" onClick={() => start('block')} className="glass text-white/80 px-4 py-2 rounded-lg text-sm">Block {name}</button>
                  <button type="button" onClick={() => setDialog(null)} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2 rounded-lg text-sm font-semibold">Done</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setDialog(null)} className="glass text-white/70 px-4 py-2 rounded-lg text-sm">Cancel</button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={busy || (dialog === 'report' && !reason)}
                    className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {busy ? 'Please wait…' : dialog === 'unmatch' ? 'Unmatch' : dialog === 'block' ? 'Block' : 'Send report'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
