'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flag, CheckCircle, Ban, Clock, AlertTriangle } from 'lucide-react';
import type { ReportStats } from '@/lib/report-stats';

type Report = {
  id: string; isRead: boolean; createdAt: string; readAt: string | null;
  reporterId: string | null; reporter: string | null;
  reportedUserId: string | null; reported: string | null;
  reason: string | null; details: string | null; kind: string | null;
};

const TARGET_HOURS = 24;
const ageHours = (d: string) => (Date.now() - new Date(d).getTime()) / 3600000;
const fmtHours = (h: number | null) => h === null ? '—' : h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h / 24)}d`;
const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });

function UserLink({ id, username }: { id: string | null; username: string | null }) {
  if (!id) return <span className="text-white/40">unknown</span>;
  return <Link href={`/admin/users/${id}`} className="text-white font-medium hover:underline">@{username ?? 'deleted'}</Link>;
}

export default function AdminReportsClient({ pending: initialPending, resolved: initialResolved, stats }: { pending: Report[]; resolved: Report[]; stats: ReportStats }) {
  const [pending, setPending] = useState(initialPending);
  const [resolved, setResolved] = useState(initialResolved);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function resolve(r: Report) {
    const res = await fetch('/api/admin/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: r.id }) });
    if (!res.ok) throw new Error('Could not resolve the report');
    setPending((p) => p.filter((x) => x.id !== r.id));
    setResolved((p) => [{ ...r, isRead: true, readAt: new Date().toISOString() }, ...p]);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setLoading(null); }
  }

  const ban = (r: Report) => run(`ban-${r.id}`, async () => {
    if (!confirm(`Ban @${r.reported ?? 'this member'}? They'll be signed out and can't sign in.`)) return;
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: r.reportedUserId, action: 'ban' }) });
    if (!res.ok) throw new Error('Could not ban the member');
    await resolve(r);
  });

  const overdueNow = pending.filter((r) => ageHours(r.createdAt) > TARGET_HOURS).length;
  const tiles = [
    { label: 'Open', value: String(pending.length), warn: false },
    { label: `Over ${TARGET_HOURS}h`, value: String(overdueNow), warn: overdueNow > 0 },
    { label: 'Oldest open', value: pending.length ? fmtHours(ageHours(pending[0].createdAt)) : '—', warn: pending.length > 0 && ageHours(pending[0].createdAt) > TARGET_HOURS },
    { label: 'Median time to handle (30d)', value: fmtHours(stats.medianHours), warn: false },
    { label: `Handled within ${TARGET_HOURS}h (30d)`, value: stats.withinTargetPct === null ? '—' : `${stats.withinTargetPct}%`, warn: stats.withinTargetPct !== null && stats.withinTargetPct < 90 },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2">
          <Flag className="text-orange-400" size={20} />
          Reports
        </h1>
        <p className="text-white/45 text-sm mt-1">Aim to handle every report within {TARGET_HOURS} hours. Oldest first. {stats.handled30d} handled in the last 30 days{stats.averageHours !== null ? ` · average ${fmtHours(stats.averageHours)}` : ''}.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8" data-testid="report-stats">
        {tiles.map((t) => (
          <div key={t.label} className={`glass rounded-xl p-4 ${t.warn ? 'border border-red-500/40' : ''}`}>
            <p className={`text-2xl font-bold ${t.warn ? 'text-red-300' : 'text-white'}`}>{t.value}</p>
            <p className="text-white/45 text-xs mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="text-red-300 text-sm mb-4">{error}</p>}

      <div className="space-y-3 mb-8">
        <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Open</h2>
        {pending.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <CheckCircle className="text-emerald-400 mx-auto mb-2" size={28} />
            <p className="text-white/40">No open reports</p>
          </div>
        ) : (
          pending.map((r) => {
            const age = ageHours(r.createdAt);
            const overdue = age > TARGET_HOURS;
            return (
              <div key={r.id} data-report={r.id} className={`glass rounded-2xl p-5 border ${overdue ? 'border-red-500/50' : 'border-orange-500/20'}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {overdue
                        ? <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={11} /> Overdue · {fmtHours(age)}</span>
                        : <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={11} /> {fmtHours(age)} old</span>}
                      <span className="text-white/35 text-xs">{fmtDate(r.createdAt)}</span>
                    </div>
                    <p className="text-white/60 text-sm">Reported: <UserLink id={r.reportedUserId} username={r.reported} /></p>
                    <p className="text-white/60 text-sm">By: <UserLink id={r.reporterId} username={r.reporter} /></p>
                    {r.reason && <p className="text-white/80 text-sm mt-1.5">{r.reason}</p>}
                    {r.details && <p className="text-white/50 text-sm mt-1 italic whitespace-pre-wrap break-words">&ldquo;{r.details}&rdquo;</p>}
                    {r.kind === 'REVIEW' && <Link href="/admin/reviews" className="inline-block text-xs text-[#D4AF37] hover:underline mt-1">Review report — moderate in Reviews →</Link>}
                    {r.reported && r.reporter && (
                      <Link href={`/admin/messages?q=${encodeURIComponent(r.reported)}`} className="inline-block text-xs text-white/50 hover:text-white hover:underline mt-1.5">Check their messages →</Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => run(`resolve-${r.id}`, () => resolve(r))} disabled={!!loading} className="flex items-center gap-1.5 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                      <CheckCircle size={12} /> Resolve
                    </button>
                    {r.reportedUserId && (
                      <button onClick={() => ban(r)} disabled={!!loading} className="flex items-center gap-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        <Ban size={12} /> Ban user
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {resolved.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Recently resolved</h2>
          {resolved.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 opacity-60">
              <p className="text-white/60 text-sm">
                <UserLink id={r.reporterId} username={r.reporter} /> reported <UserLink id={r.reportedUserId} username={r.reported} />
                {r.reason ? <span className="text-white/40"> · {r.reason}</span> : null}
              </p>
              <p className="text-white/35 text-xs mt-0.5">
                {fmtDate(r.createdAt)}{r.readAt ? ` · handled in ${fmtHours((new Date(r.readAt).getTime() - new Date(r.createdAt).getTime()) / 3600000)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
