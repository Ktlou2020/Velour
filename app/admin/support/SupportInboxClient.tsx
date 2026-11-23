'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LifeBuoy, Mail, User, Send, Lock, RotateCcw, ArrowLeft } from 'lucide-react';
import { categoryLabel, ticketRef, REPLY_MAX } from '@/lib/support';
import type { TicketCounts, TicketSummary } from '@/lib/support-admin';

type Filter = 'OPEN' | 'ANSWERED' | 'CLOSED' | 'ALL';

interface Person { username: string; displayName: string | null }
interface Ticket {
  id: string;
  userId: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  member: Person | null;
  repliedBy: Person | null;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ANSWERED', label: 'Answered' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
];

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-[#DC143C]/15 text-[#FF8FA3] border-[#DC143C]/30',
  ANSWERED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  CLOSED: 'bg-white/5 text-white/50 border-white/10',
};

function when(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] ?? STATUS_STYLE.CLOSED}`}>
      {status.toLowerCase()}
    </span>
  );
}

export default function SupportInboxClient({ initial }: { initial: { tickets: TicketSummary[]; counts: TicketCounts } }) {
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [tickets, setTickets] = useState<TicketSummary[]>(initial.tickets);
  const [counts, setCounts] = useState<TicketCounts>(initial.counts);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<'reply' | 'close' | 'reopen' | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadList(f: Filter) {
    setFilter(f);
    setListLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${f}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setCounts(data.counts);
      }
    } finally {
      setListLoading(false);
    }
  }

  async function openTicket(id: string) {
    setOpeningId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/support/${id}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSelected(data.ticket);
        setReply('');
      }
    } finally {
      setOpeningId(null);
    }
  }

  async function act(action: 'reply' | 'close' | 'reopen') {
    if (!selected) return;
    setBusy(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reply' ? { action, reply } : { action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || 'Something went wrong.' });
        return;
      }
      setSelected(data.ticket);
      if (action === 'reply') {
        setReply('');
        setNotice({ ok: data.emailed !== false, text: data.emailed !== false ? `Reply sent to ${selected.email}.` : 'Reply saved, but the email could not be sent.' });
      } else {
        setNotice({ ok: true, text: action === 'close' ? 'Ticket closed.' : 'Ticket reopened.' });
      }
      await loadList(filter);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2">
          <LifeBuoy className="text-[#DC143C]" size={20} aria-hidden="true" />
          Support
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {counts.OPEN} open · {counts.ANSWERED} answered · {counts.CLOSED} closed
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Filter tickets">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => loadList(f.value)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              filter === f.value ? 'bg-[#DC143C]/20 border-[#DC143C]/40 text-white' : 'border-white/10 text-white/50 hover:text-white hover:border-white/20'
            }`}
          >
            {f.label}
            {f.value !== 'ALL' && <span className="ml-1.5 text-white/40">{counts[f.value]}</span>}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
        {/* List */}
        <div className={`space-y-2 ${selected ? 'hidden lg:block' : ''} ${listLoading ? 'opacity-60' : ''}`}>
          {tickets.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-white/40 text-sm">No tickets here.</div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => openTicket(t.id)}
                disabled={openingId === t.id}
                className={`w-full text-left glass rounded-2xl p-4 transition-colors hover:bg-white/[0.07] ${selected?.id === t.id ? 'ring-1 ring-[#DC143C]/50' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusPill status={t.status} />
                  <span className="text-white/40 text-xs">#{ticketRef(t.id)} · {categoryLabel(t.category)}</span>
                  <span className="text-white/30 text-xs ml-auto flex-shrink-0">{when(t.createdAt)}</span>
                </div>
                <p className="text-white font-medium text-sm truncate">{t.subject}</p>
                <p className="text-white/50 text-xs truncate">
                  {t.member ? `${t.member.displayName || t.member.username} · ` : 'Visitor · '}{t.email}
                </p>
                <p className="text-white/40 text-xs mt-1 line-clamp-2">{t.preview}</p>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className={selected ? '' : 'hidden lg:block'}>
          {!selected ? (
            <div className="glass rounded-2xl p-8 text-center text-white/40 text-sm">Choose a ticket to read it.</div>
          ) : (
            <div className="glass rounded-2xl p-5 md:p-6 space-y-5">
              <button onClick={() => setSelected(null)} className="lg:hidden flex items-center gap-1 text-white/50 hover:text-white text-sm">
                <ArrowLeft size={14} aria-hidden="true" /> All tickets
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusPill status={selected.status} />
                  <span className="text-white/40 text-xs">#{ticketRef(selected.id)} · {categoryLabel(selected.category)} · {when(selected.createdAt)}</span>
                </div>
                <h2 className="text-white text-lg font-semibold break-words">{selected.subject}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                  <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-white/60 hover:text-white">
                    <Mail size={14} aria-hidden="true" /> {selected.email}
                  </a>
                  {selected.userId ? (
                    <Link href={`/admin/users/${selected.userId}`} className="flex items-center gap-1.5 text-[#DC143C] hover:underline">
                      <User size={14} aria-hidden="true" />
                      {selected.member ? `${selected.member.displayName || selected.member.username} (@${selected.member.username})` : 'Member (account deleted)'}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5 text-white/40"><User size={14} aria-hidden="true" /> Visitor (not signed in)</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 text-white/80 text-sm whitespace-pre-wrap break-words">
                {selected.message}
              </div>

              {selected.adminReply && (
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                  <p className="text-emerald-300 text-xs mb-2">
                    Replied{selected.repliedBy ? ` by ${selected.repliedBy.displayName || selected.repliedBy.username}` : ''}{selected.repliedAt ? ` · ${when(selected.repliedAt)}` : ''}
                  </p>
                  <p className="text-white/80 text-sm whitespace-pre-wrap break-words">{selected.adminReply}</p>
                </div>
              )}

              <div>
                <label htmlFor="support-reply" className="block text-white/70 text-sm mb-2">
                  {selected.adminReply ? 'Send another reply' : 'Reply'} <span className="text-white/30">(emailed to the member)</span>
                </label>
                <textarea
                  id="support-reply"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={REPLY_MAX}
                  rows={6}
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-y"
                  placeholder="Hi there, thanks for getting in touch…"
                />
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    onClick={() => act('reply')}
                    disabled={busy !== null || reply.trim().length < 2}
                    className="flex items-center gap-2 bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <Send size={14} aria-hidden="true" /> {busy === 'reply' ? 'Sending…' : 'Send reply'}
                  </button>
                  {selected.status === 'CLOSED' ? (
                    <button
                      onClick={() => act('reopen')}
                      disabled={busy !== null}
                      className="flex items-center gap-2 glass border border-white/15 text-white/80 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
                    >
                      <RotateCcw size={14} aria-hidden="true" /> Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => act('close')}
                      disabled={busy !== null}
                      className="flex items-center gap-2 glass border border-white/15 text-white/80 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
                    >
                      <Lock size={14} aria-hidden="true" /> Close
                    </button>
                  )}
                  <span className="text-white/30 text-xs ml-auto">{reply.length}/{REPLY_MAX}</span>
                </div>
                {notice && (
                  <p role={notice.ok ? 'status' : 'alert'} className={`text-sm mt-3 ${notice.ok ? 'text-emerald-400' : 'text-[#FF8FA3]'}`}>{notice.text}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
