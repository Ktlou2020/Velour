'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Link2, Link2Off, Check, X, Clock } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';

interface CoupleState {
  partner: { username: string; displayName: string | null; profilePhoto: string | null } | null;
  incoming: { id: string; username: string; displayName: string | null }[];
  outgoing: { id: string; username: string; displayName: string | null }[];
}

/**
 * Linked-accounts couples: invite a partner by username, accept / decline
 * invitations, cancel ones you sent, and unlink. Either partner can unlink.
 */
export default function CoupleLinkCard() {
  const [state, setState] = useState<CoupleState | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/couple/invite');
      if (res.ok) setState(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function call(key: string, url: string, method: string, body?: unknown, okText?: string) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; alreadyPending?: boolean };
      if (!res.ok) { setMessage({ ok: false, text: data.error || 'Something went wrong — please try again' }); return false; }
      if (okText) setMessage({ ok: true, text: data.alreadyPending ? 'You’ve already invited them — waiting for them to accept.' : okText });
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().replace(/^@/, '');
    if (!u) return;
    if (await call('invite', '/api/couple/invite', 'POST', { partnerUsername: u }, `Invitation sent to @${u}`)) setUsername('');
  }

  async function accept(id: string) {
    if (await call(`accept-${id}`, '/api/couple/accept', 'POST', { inviteId: id }, 'You’re now linked as a couple')) {
      window.location.reload();
    }
  }

  async function unlink() {
    if (await call('unlink', '/api/couple/unlink', 'POST', undefined, 'Profiles unlinked')) {
      setConfirmUnlink(false);
      window.location.reload();
    }
  }

  const partner = state?.partner;

  return (
    <section id="couple" className="glass rounded-2xl p-5 sm:p-6 mb-6 scroll-mt-20" aria-labelledby="couple-h">
      <h2 id="couple-h" className="text-white font-semibold flex items-center gap-2 mb-1">
        <Link2 size={16} className="text-[#DC143C]" aria-hidden="true" />
        Link with your partner
      </h2>
      <p className="text-white/60 text-sm mb-5">
        Each of you has your own account? Link them so you appear together as a couple. Either of you can unlink at any time.
      </p>

      {!state ? (
        <div className="h-12 rounded-xl skeleton" aria-busy="true" />
      ) : partner ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center overflow-hidden flex-shrink-0">
              {partner.profilePhoto
                ? <ProtectedImage src={partner.profilePhoto} alt="" className="w-full h-full" />
                : <span className="text-white font-bold text-sm">{(partner.displayName || partner.username).slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{partner.displayName || partner.username}</p>
              <Link href={`/members/${partner.username}`} className="text-[#FF4D6D] text-xs hover:underline">@{partner.username} · View profile</Link>
            </div>
          </div>
          {confirmUnlink ? (
            <div className="flex items-center gap-2" role="group" aria-label="Confirm unlink">
              <span className="text-white/70 text-sm">Unlink?</span>
              <button onClick={unlink} disabled={busy === 'unlink'} className="min-h-[40px] bg-red-600 hover:bg-red-500 text-white px-4 rounded-xl text-sm font-semibold disabled:opacity-60">
                {busy === 'unlink' ? 'Unlinking…' : 'Yes, unlink'}
              </button>
              <button onClick={() => setConfirmUnlink(false)} className="min-h-[40px] glass px-3 rounded-xl text-white/70 text-sm">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmUnlink(true)} className="min-h-[40px] flex items-center justify-center gap-1.5 text-sm glass border border-white/10 hover:border-red-500/30 text-white/65 hover:text-red-400 px-4 rounded-xl transition-all">
              <Link2Off size={14} aria-hidden="true" /> Unlink partner
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {state.incoming.map((inv) => (
            <div key={inv.id} className="border border-[#D4AF37]/30 bg-[#D4AF37]/5 rounded-xl p-4">
              <p className="text-white text-sm mb-3">
                <Link href={`/members/${inv.username}`} className="text-[#D4AF37] font-semibold hover:underline">@{inv.username}</Link>
                {inv.displayName ? <span className="text-white/60"> ({inv.displayName})</span> : null} would like to link profiles with you as a couple.
              </p>
              <div className="flex gap-2">
                <button onClick={() => accept(inv.id)} disabled={!!busy} className="min-h-[40px] flex items-center gap-1.5 bg-[#D4AF37] text-[#0A0A0F] font-semibold px-4 rounded-lg text-sm hover:bg-[#F4D03F] disabled:opacity-60">
                  <Check size={14} aria-hidden="true" /> {busy === `accept-${inv.id}` ? 'Accepting…' : 'Accept'}
                </button>
                <button onClick={() => call(`decline-${inv.id}`, '/api/couple/decline', 'POST', { inviteId: inv.id }, 'Invitation declined')} disabled={!!busy} className="min-h-[40px] flex items-center gap-1.5 glass px-4 rounded-lg text-sm text-white/70 hover:text-white disabled:opacity-60">
                  <X size={14} aria-hidden="true" /> Decline
                </button>
              </div>
            </div>
          ))}

          {state.outgoing.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
              <p className="text-white/75 text-sm flex items-center gap-2 min-w-0">
                <Clock size={14} className="text-white/45 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">Waiting for @{inv.username} to accept</span>
              </p>
              <button onClick={() => call(`cancel-${inv.id}`, '/api/couple/invite', 'DELETE', { inviteId: inv.id }, 'Invitation cancelled')} disabled={!!busy} className="min-h-[36px] text-xs text-white/60 hover:text-red-400 px-2 flex-shrink-0">
                Cancel invite
              </button>
            </div>
          ))}

          <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="couple-username" className="sr-only">Partner’s username</label>
            <input
              id="couple-username"
              type="text"
              placeholder="Partner’s username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-dark flex-1 min-w-0"
              autoCapitalize="none"
              spellCheck={false}
            />
            <button type="submit" disabled={busy === 'invite' || !username.trim()} className="min-h-[44px] flex items-center justify-center gap-2 bg-[#DC143C]/20 hover:bg-[#DC143C]/30 border border-[#DC143C]/30 text-[#FF4D6D] px-4 rounded-xl text-sm font-medium disabled:opacity-50">
              <Link2 size={14} aria-hidden="true" /> {busy === 'invite' ? 'Sending…' : 'Send invitation'}
            </button>
          </form>
        </div>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm mt-3 ${message.ok ? 'text-emerald-400' : 'text-[#FF8FA3]'}`}>{message.text}</p>
      )}
    </section>
  );
}
