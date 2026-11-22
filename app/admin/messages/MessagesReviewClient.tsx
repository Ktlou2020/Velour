'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquareWarning, Search, ShieldAlert, ScrollText, CheckCircle, X, Lock, Mic, Inbox } from 'lucide-react';
import { FLAG_LABELS, type FlagCategory } from '@/lib/message-flags';

type Person = { id: string; username: string; displayName: string | null };
type Flag = { id: string; conversationId: string; senderId: string; categories: string[]; excerpt: string; createdAt: string; sender: Person | null };
type Member = { id: string; username: string; email: string; isActive: boolean; displayName: string | null; conversations: number; messagesSent: number; flagged: number };
type Conv = { id: string; lastMessageAt: string; messages: number; flagged: number; with: Person[] };
type Msg = { id: string; sender: string; senderId: string; content: string | null; kind: string; imageUrl: string | null; videoUrl?: string | null; hasAudio: boolean; viewOnce: boolean; createdAt: string; flag: { categories: string[]; reviewedAt: string | null } | null };
type FeedMsg = { id: string; conversationId: string; createdAt: string; from: Person; fromPartner: string | null; to: Person[]; content: string | null; kind: string; imageUrl: string | null; videoUrl: string | null; hasAudio: boolean; viewOnce: boolean; flag: { categories: string[] } | null };
type Opened = { id: string; participants: Person[]; messages: Msg[] };
type LogRow = { id: string; action: string; createdAt: string; actor: string; meta: { conversationId?: string; reason?: string; participants?: string[] } | null };

const CAT_STYLE: Record<string, string> = {
  UNDERAGE: 'bg-red-600/25 text-red-200 border-red-500/40',
  THREAT: 'bg-red-500/20 text-red-300 border-red-500/30',
  SCAM: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  HARASSMENT: 'bg-orange-500/15 text-orange-200 border-orange-500/30',
  CONTACT: 'bg-white/10 text-white/70 border-white/15',
};

function fmt(d: string) {
  return new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
}
const nameOf = (p: Person | null | undefined) => (p ? p.displayName || p.username : 'Unknown');

function Chips({ cats }: { cats: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {cats.map((c) => (
        <span key={c} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CAT_STYLE[c] ?? CAT_STYLE.CONTACT}`}>
          {FLAG_LABELS[c as FlagCategory] ?? c}
        </span>
      ))}
    </span>
  );
}

/** Photo or video sent in a chat (view-once media is never sent to this page). */
function Media({ imageUrl, videoUrl }: { imageUrl: string | null; videoUrl?: string | null }) {
  if (videoUrl) return <video src={videoUrl} controls preload="none" className="mt-2 max-h-64 rounded-lg bg-black" />;
  if (!imageUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt="Photo sent in chat" loading="lazy" className="mt-2 max-h-64 rounded-lg object-contain bg-black/40" /></a>;
}

export default function MessagesReviewClient({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [tab, setTab] = useState<'latest' | 'flags' | 'search' | 'log'>(isSuperAdmin ? 'latest' : 'flags');
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [q, setQ] = useState('');
  const [members, setMembers] = useState<Member[] | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  // Opening a conversation: pick → reason → transcript
  const [pending, setPending] = useState<{ conversationId: string; label: string; defaultReason: string } | null>(null);
  // Super admin: newest messages across the site (one reason per viewing, logged)
  const [feedReason, setFeedReason] = useState('');
  const [feed, setFeed] = useState<FeedMsg[] | null>(null);
  const [feedNext, setFeedNext] = useState<string | null>(null);
  const [feedAsk, setFeedAsk] = useState(false);
  const [reason, setReason] = useState('');
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadFlags = useCallback(() => {
    fetch('/api/admin/messages?view=flags').then((r) => r.json()).then((d) => setFlags(d.flags ?? [])).catch(() => setFlags([]));
  }, []);
  useEffect(() => { loadFlags(); }, [loadFlags]);
  // Linked from a member's admin page: /admin/messages?q=username
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get('q');
    if (!preset) return;
    setTab('search');
    setQ(preset);
    fetch(`/api/admin/messages?view=search&q=${encodeURIComponent(preset)}`).then((r) => r.json()).then((d) => setMembers(d.members ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (tab === 'log' && isSuperAdmin && log === null) {
      fetch('/api/admin/messages?view=log').then((r) => r.json()).then((d) => setLog(d.log ?? [])).catch(() => setLog([]));
    }
  }, [tab, isSuperAdmin, log]);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setMember(null); setConvs(null);
    const d = await fetch(`/api/admin/messages?view=search&q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ members: [] }));
    setMembers(d.members ?? []);
  }

  async function openInbox(m: Member) {
    setMember(m); setConvs(null);
    const d = await fetch(`/api/admin/messages?view=inbox&userId=${m.id}`).then((r) => r.json()).catch(() => ({ conversations: [] }));
    setConvs(d.conversations ?? []);
  }

  function ask(conversationId: string, label: string, defaultReason = '') {
    setError(''); setReason(defaultReason); setOpened(null);
    setPending({ conversationId, label, defaultReason });
  }

  async function confirmOpen(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/messages/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: pending.conversationId, reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'Couldn’t open the conversation'); return; }
      setOpened(d.conversation); setPending(null);
      if (isSuperAdmin) setLog(null);
    } finally { setBusy(false); }
  }

  async function loadFeed(e?: React.FormEvent, before?: string) {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/messages/latest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: feedReason, ...(before ? { before } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'Couldn’t load messages'); return; }
      setFeed((prev) => (before ? [...(prev ?? []), ...d.messages] : d.messages));
      setFeedNext(d.nextBefore);
      setFeedAsk(false);
      if (!before) setLog(null);
    } finally { setBusy(false); }
  }

  async function openFromFeed(conversationId: string) {
    const res = await fetch('/api/admin/messages/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, reason: `From the latest messages feed: ${feedReason}` }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setOpened(d.conversation); setLog(null); }
  }

  async function markReviewed(id: string) {
    await fetch('/api/admin/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flagId: id, action: 'reviewed' }) });
    setFlags((f) => (f ?? []).filter((x) => x.id !== id));
  }

  const tabs = [
    ...(isSuperAdmin ? [{ key: 'latest' as const, label: 'Latest', icon: Inbox }] : []),
    { key: 'flags' as const, label: `Flagged${flags && flags.length ? ` (${flags.length})` : ''}`, icon: ShieldAlert },
    { key: 'search' as const, label: 'Search members', icon: Search },
    ...(isSuperAdmin ? [{ key: 'log' as const, label: 'Access log', icon: ScrollText }] : []),
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2">
          <MessageSquareWarning className="text-[#FF4D6D]" size={20} /> Message review
        </h1>
        <p className="text-white/50 text-sm mt-1 max-w-2xl">
          For member safety only. Opening a conversation needs a reason and is logged{isSuperAdmin ? '' : ' — the super admin can see every opening'}. Members are told in the Privacy Policy that staff may review messages for safety.
        </p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === key ? 'bg-[#DC143C] text-white' : 'glass text-white/65 hover:text-white'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'latest' && isSuperAdmin && (
        <div>
          {feed === null ? (
            <div className="glass rounded-2xl p-6">
              <p className="text-white/80 text-sm mb-3">The newest messages across Unbound, with photos and videos (view-once media is never shown). Your reason is saved in the access log.</p>
              <button onClick={() => { setError(''); setFeedAsk(true); }} className="bg-[#DC143C] hover:bg-[#FF1744] text-white text-sm font-semibold px-4 py-2 rounded-xl">Show latest messages</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white/50 text-xs">Reason: {feedReason}</p>
                <button onClick={() => loadFeed()} disabled={busy} className="glass text-white/70 hover:text-white text-xs px-3 py-1.5 rounded-lg">Refresh</button>
              </div>
              {feed.length === 0 && <p className="text-white/50 text-sm">No messages yet</p>}
              {feed.map((m) => (
                <div key={m.id} className={`glass rounded-2xl p-4 ${m.flag ? 'border border-amber-500/30' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                    <span className="text-white/85">
                      <span className="font-semibold">{nameOf(m.from)}</span>{m.fromPartner ? ` (${m.fromPartner})` : ''} <span className="text-white/40">@{m.from.username}</span>
                      <span className="text-white/40"> → </span>{m.to.map(nameOf).join(', ') || 'former member'}
                    </span>
                    <span className="text-white/45">{fmt(m.createdAt)}</span>
                  </div>
                  {m.flag && <div className="mb-1.5"><Chips cats={m.flag.categories} /></div>}
                  {m.content && <p className="text-white/90 text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                  {m.viewOnce ? <p className="text-white/45 text-xs flex items-center gap-1"><Lock size={11} /> View-once media (not shown)</p> : <Media imageUrl={m.imageUrl} videoUrl={m.videoUrl} />}
                  {m.hasAudio && <p className="text-white/45 text-xs flex items-center gap-1 mt-1"><Mic size={11} /> Voice note</p>}
                  {m.kind === 'GAME' && !m.content && <p className="text-white/45 text-xs">Chat game</p>}
                  <button onClick={() => openFromFeed(m.conversationId)} className="mt-2 text-[#FF85A1] hover:text-white text-xs">Open conversation</button>
                </div>
              ))}
              {feedNext && (
                <button onClick={() => loadFeed(undefined, feedNext)} disabled={busy} className="w-full glass text-white/70 hover:text-white text-sm py-2.5 rounded-xl">{busy ? 'Loading…' : 'Load older'}</button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'flags' && (
        <div className="space-y-3">
          {flags === null ? <p className="text-white/50 text-sm">Loading…</p> : flags.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center"><CheckCircle className="text-emerald-400 mx-auto mb-2" size={28} /><p className="text-white/50">Nothing flagged to review</p></div>
          ) : flags.map((f) => (
            <div key={f.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <Chips cats={f.categories} />
                <span className="text-white/45 text-xs">{fmt(f.createdAt)}</span>
              </div>
              <p className="text-white/80 text-sm mb-1"><span className="text-white/50">From</span> {nameOf(f.sender)} {f.sender && <span className="text-white/40">@{f.sender.username}</span>}</p>
              <p className="text-white/90 text-sm bg-white/5 rounded-xl px-3 py-2 mb-3 break-words">“{f.excerpt}”</p>
              <div className="flex gap-2">
                <button onClick={() => ask(f.conversationId, `Conversation involving ${nameOf(f.sender)}`, `Reviewing a flagged message (${f.categories.map((c) => FLAG_LABELS[c as FlagCategory] ?? c).join(', ')})`)} className="bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold px-3 py-2 rounded-lg">Open conversation</button>
                <button onClick={() => markReviewed(f.id)} className="glass text-white/70 hover:text-white text-xs px-3 py-2 rounded-lg">Mark reviewed</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'search' && (
        <div>
          <form onSubmit={search} className="flex gap-2 mb-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username, name or email" aria-label="Search members" className="input-dark flex-1 px-4 py-2.5 rounded-xl text-sm" />
            <button className="bg-[#DC143C] hover:bg-[#FF1744] text-white text-sm font-semibold px-4 rounded-xl">Search</button>
          </form>
          {!member && members && (members.length === 0 ? <p className="text-white/50 text-sm">No members found</p> : (
            <div className="space-y-2">
              {members.map((m) => (
                <button key={m.id} onClick={() => openInbox(m)} className="w-full text-left glass rounded-xl px-4 py-3 hover:bg-white/5 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-white text-sm font-medium truncate">{m.displayName || m.username} <span className="text-white/40">@{m.username}</span>{!m.isActive && <span className="text-red-300 text-xs ml-2">banned</span>}</span>
                    <span className="block text-white/45 text-xs truncate">{m.email}</span>
                  </span>
                  <span className="text-white/55 text-xs flex-shrink-0">{m.conversations} chats · {m.messagesSent} sent{m.flagged ? <span className="text-amber-300"> · {m.flagged} flagged</span> : ''}</span>
                </button>
              ))}
            </div>
          ))}
          {member && (
            <div>
              <button onClick={() => { setMember(null); setConvs(null); }} className="text-white/60 hover:text-white text-sm mb-3">← Back to results</button>
              <h2 className="text-white font-semibold mb-3">{member.displayName || member.username}&apos;s conversations</h2>
              {convs === null ? <p className="text-white/50 text-sm">Loading…</p> : convs.length === 0 ? <p className="text-white/50 text-sm">No conversations</p> : (
                <div className="space-y-2">
                  {convs.map((c) => (
                    <button key={c.id} onClick={() => ask(c.id, `${member.displayName || member.username} ↔ ${c.with.map(nameOf).join(', ')}`)} className="w-full text-left glass rounded-xl px-4 py-3 hover:bg-white/5 flex items-center justify-between gap-3">
                      <span className="text-white text-sm truncate">with {c.with.map(nameOf).join(', ') || 'former member'}</span>
                      <span className="text-white/55 text-xs flex-shrink-0 flex items-center gap-2">{c.messages} messages · {fmt(c.lastMessageAt)}{c.flagged ? <span className="text-amber-300">{c.flagged} flagged</span> : null}<Lock size={11} /></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'log' && isSuperAdmin && (
        <div className="space-y-2">
          {log === null ? <p className="text-white/50 text-sm">Loading…</p> : log.length === 0 ? <p className="text-white/50 text-sm">No conversations opened yet</p> : log.map((l) => (
            <div key={l.id} className="glass rounded-xl px-4 py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-white">{l.actor} <span className="text-white/50">{l.action === 'MESSAGES_VIEWED' ? 'opened a conversation' : l.action === 'LATEST_MESSAGES_VIEWED' ? 'viewed the latest messages' : 'cleared a flag'}</span>{l.meta?.participants?.length ? <span className="text-white/70"> — {l.meta.participants.map((p) => '@' + p).join(' ↔ ')}</span> : null}</span>
                <span className="text-white/45 text-xs">{fmt(l.createdAt)}</span>
              </div>
              {l.meta?.reason && <p className="text-white/60 text-xs mt-1">Reason: {l.meta.reason}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Reason prompt for the latest-messages feed */}
      {feedAsk && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="feed-reason-title">
          <form onSubmit={loadFeed} className="glass-dark rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 id="feed-reason-title" className="text-white font-semibold mb-1">Why are you viewing recent messages?</h2>
            <p className="text-white/55 text-xs mb-4">Saved in the access log.</p>
            <textarea value={feedReason} onChange={(e) => setFeedReason(e.target.value)} rows={3} maxLength={300} autoFocus placeholder="e.g. Daily safety check of new conversations" className="input-dark w-full px-3 py-2 rounded-xl text-sm resize-none" aria-label="Reason" />
            {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setFeedAsk(false)} className="glass text-white/70 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button disabled={busy || feedReason.trim().length < 10} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{busy ? 'Loading…' : 'Show messages'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Reason prompt */}
      {pending && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reason-title">
          <form onSubmit={confirmOpen} className="glass-dark rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 id="reason-title" className="text-white font-semibold mb-1">Why are you opening this conversation?</h2>
            <p className="text-white/55 text-xs mb-4">{pending.label}. Your reason is saved in the access log.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} autoFocus placeholder="e.g. Member reported harassment on 22 Nov" className="input-dark w-full px-3 py-2 rounded-xl text-sm resize-none" aria-label="Reason" />
            {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setPending(null)} className="glass text-white/70 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button disabled={busy || reason.trim().length < 10} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{busy ? 'Opening…' : 'Open'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Transcript */}
      {opened && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Conversation">
          <div className="glass-dark rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <p className="text-white font-semibold text-sm">{opened.participants.map((p) => `${p.displayName || p.username} (@${p.username})`).join(' ↔ ')}</p>
              <button onClick={() => setOpened(null)} aria-label="Close" className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-3">
              {opened.messages.length === 0 && <p className="text-white/50 text-sm">No messages</p>}
              {opened.messages.map((m) => (
                <div key={m.id} className={`rounded-xl px-3 py-2 ${m.flag ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5'}`}>
                  <div className="flex justify-between gap-2 text-xs mb-1">
                    <span className="text-white/80 font-medium">{m.sender}</span>
                    <span className="text-white/40">{fmt(m.createdAt)}</span>
                  </div>
                  {m.flag && <div className="mb-1"><Chips cats={m.flag.categories} /></div>}
                  {m.content && <p className="text-white/90 text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                  {m.viewOnce ? <p className="text-white/45 text-xs flex items-center gap-1"><Lock size={11} /> View-once media (not shown)</p>
                    : <Media imageUrl={m.imageUrl} videoUrl={m.videoUrl} />}
                  {m.hasAudio && <p className="text-white/45 text-xs flex items-center gap-1"><Mic size={11} /> Voice note</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
