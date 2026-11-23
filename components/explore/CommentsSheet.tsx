'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Send, BadgeCheck, Trash2, Flag } from 'lucide-react';
import { Avatar, Spinner } from '@/components/gallery/ui';
import { useToast } from '@/lib/toast-context';

export interface PhotoComment {
  id: string;
  body: string;
  createdAt: string;
  author: { username: string; name: string; avatarUrl: string | null; isVerified: boolean; isPhotoOwner: boolean };
  isMine: boolean;
  canDelete: boolean;
}

const MAX = 500;

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/**
 * Comments on one Gallery photo, as a sheet over the photo viewer.
 * `onCount` reports the new total after posting or deleting.
 */
export default function CommentsSheet({ photoId, ownerName, count, onCount, onClose }: {
  photoId: string;
  ownerName: string;
  count: number;
  onCount: (n: number) => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [comments, setComments] = useState<PhotoComment[] | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState<PhotoComment | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const total = useRef(count);
  total.current = count;

  const load = useCallback(async (older?: string) => {
    const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}/comments${older ? `?before=${encodeURIComponent(older)}` : ''}`, { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Couldn’t load comments');
    return d as { comments: PhotoComment[]; before: string | null };
  }, [photoId]);

  useEffect(() => {
    let alive = true;
    setComments(null);
    load().then((d) => {
      if (!alive) return;
      setComments(d.comments);
      setBefore(d.before);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }).catch((e) => { if (alive) { setComments([]); setError(e.message); } });
    return () => { alive = false; };
  }, [load]);

  // Escape closes the sheet (the viewer below ignores keys while a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  async function older() {
    if (!before) return;
    setLoadingOlder(true);
    try {
      const d = await load(before);
      setComments((c) => [...d.comments, ...(c ?? [])]);
      setBefore(d.before);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Couldn’t load comments', 'error'); }
    finally { setLoadingOlder(false); }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'Couldn’t post your comment'); return; }
      setText('');
      setSending(false);
      onCount(total.current + 1);
      const fresh = await load().catch(() => null);
      if (fresh) { setComments(fresh.comments); setBefore(fresh.before); }
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
    } catch { setError('Couldn’t post your comment'); }
    finally { setSending(false); }
  }

  async function remove(c: PhotoComment) {
    if (!confirm(c.isMine ? 'Delete your comment?' : `Delete this comment by ${c.author.name}?`)) return;
    const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}/comments/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Couldn’t delete the comment', 'error'); return; }
    setComments((list) => (list ?? []).filter((x) => x.id !== c.id));
    onCount(Math.max(0, total.current - 1));
  }

  async function report(c: PhotoComment, reason: string) {
    const res = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUsername: c.author.username, reason, note: `Gallery comment on /gallery/explore?photo=${photoId}&comments=1: “${c.body.slice(0, 300)}”` }),
    });
    setReporting(null);
    showToast(res.ok ? 'Thanks — our team will review this comment.' : 'Couldn’t send the report', res.ok ? 'success' : 'error');
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="comments-title" data-testid="comments-sheet">
      <button type="button" aria-label="Close comments" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[80vh] sm:max-h-[75vh] flex flex-col glass-dark border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
          <h2 id="comments-title" className="text-white font-semibold">Comments{count ? <span className="text-white/45 font-normal"> · {count}</span> : null}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-full text-white/60 hover:text-white hover:bg-white/10"><X size={18} /></button>
        </div>

        <div ref={listRef} className="flex-1 min-h-[160px] overflow-y-auto px-5 py-3 space-y-4" aria-live="polite">
          {before && (
            <button type="button" onClick={older} disabled={loadingOlder} className="w-full text-center text-xs text-white/55 hover:text-white py-1">
              {loadingOlder ? 'Loading…' : 'Show earlier comments'}
            </button>
          )}
          {comments === null ? (
            <div className="flex justify-center py-8"><Spinner size={20} /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-white/50 text-sm py-8">No comments yet. Say something nice to {ownerName}.</p>
          ) : comments.map((c) => (
            <div key={c.id} className="flex gap-3 group" data-comment={c.id}>
              <Link href={`/members/${encodeURIComponent(c.author.username)}`} className="shrink-0"><Avatar url={c.author.avatarUrl} name={c.author.name} size={34} /></Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <Link href={`/members/${encodeURIComponent(c.author.username)}`} className="text-white font-semibold hover:underline">{c.author.name}</Link>
                  {c.author.isVerified && <BadgeCheck size={13} className="inline ml-1 -mt-0.5 text-sky-400" aria-label="Verified" />}
                  {c.author.isPhotoOwner && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#FF4D6D]">Owner</span>}
                  <span className="text-white/35 text-xs ml-2">{ago(c.createdAt)}</span>
                </p>
                <p className="text-white/85 text-sm mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              <div className="flex items-start gap-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {c.canDelete && (
                  <button type="button" onClick={() => remove(c)} aria-label="Delete comment" className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"><Trash2 size={14} /></button>
                )}
                {!c.isMine && (
                  <button type="button" onClick={() => setReporting(c)} aria-label="Report comment" className="p-1.5 rounded-lg text-white/50 hover:text-red-300 hover:bg-white/10"><Flag size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 px-4 py-3">
          {error && <p role="alert" className="text-red-300 text-xs mb-2">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, MAX)); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              maxLength={MAX}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="input-dark flex-1 px-4 py-2.5 rounded-2xl text-sm resize-none max-h-28"
            />
            <button type="button" onClick={send} disabled={!text.trim() || sending} aria-label="Post comment" className="h-10 w-10 shrink-0 rounded-full bg-[#DC143C] hover:bg-[#FF1744] text-white flex items-center justify-center disabled:opacity-40">
              {sending ? <Spinner /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-white/30 text-[11px] mt-1.5">Comments are public to members. No phone numbers or contact details.</p>
        </div>

        {reporting && (
          <div className="absolute inset-0 rounded-t-3xl sm:rounded-3xl bg-[#0A0A0F]/95 flex flex-col justify-center p-6" role="dialog" aria-modal="true" aria-label="Report comment">
            <p className="text-white font-semibold mb-1">Report this comment?</p>
            <p className="text-white/55 text-sm mb-4 line-clamp-3">“{reporting.body}”</p>
            <div className="space-y-2">
              {['Harassment or abuse', 'Spam or scam', 'Inappropriate content', 'Other'].map((r) => (
                <button key={r} type="button" onClick={() => report(reporting, r)} className="w-full text-left rounded-xl border border-white/10 hover:border-white/25 px-4 py-2.5 text-sm text-white/85">{r}</button>
              ))}
            </div>
            <button type="button" onClick={() => setReporting(null)} className="mt-4 text-white/55 text-sm hover:text-white">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
