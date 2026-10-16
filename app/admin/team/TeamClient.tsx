'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedImage from '@/components/ProtectedImage';
import { Crown, ShieldCheck, ShieldOff, UserPlus, History } from 'lucide-react';

interface Admin {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  appointedAt: string | null;
  createdAt: string;
  profile: { displayName: string | null; profilePhoto: string | null; lastSeen: string | null } | null;
}

interface LogRow {
  id: string;
  action: string;
  createdAt: string;
  actor: string;
  target: string | null;
  meta: { tier?: string } | null;
}

interface TeamData {
  viewerIsSuperAdmin: boolean;
  viewerId: string;
  admins: Admin[];
  log: LogRow[];
}

const ACTION_TEXT: Record<string, [string, string]> = {
  ADMIN_APPOINTED: ['appointed', 'as admin'],
  ADMIN_REMOVED: ['removed', 'as admin'],
  USER_BANNED: ['banned', ''],
  USER_UNBANNED: ['unbanned', ''],
};

function when(d: string) {
  return new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' });
}

function DemoProfilesCard() {
  const [count, setCount] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/demo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCount(d.count); setCanManage(!!d.canManage); } })
      .catch(() => {});
  }, []);

  async function run(action: 'seed' | 'remove') {
    if (action === 'remove' && !window.confirm('Remove all demo profiles? This deletes them and any chats with them.')) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error ?? 'Something went wrong.'); return; }
      setCount(d.count);
      setMsg(action === 'seed' ? `Added ${d.created} demo profiles${d.skipped ? ` (${d.skipped} already existed)` : ''}.` : `Removed ${d.removed} demo profiles.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass rounded-2xl mt-6 p-4 sm:p-5" aria-labelledby="demo-h">
      <h2 id="demo-h" className="text-white/80 text-sm font-medium">Demo profiles {count !== null && <span className="text-white/40">({count})</span>}</h2>
      <p className="text-white/50 text-xs mt-1 leading-relaxed">
        30 sample members across South Africa so the site doesn&apos;t look empty at launch. They never like or message anyone,
        don&apos;t count towards founding spots, analytics or emails. Remove them before you start taking payments.
      </p>
      {msg && <p role="status" className="text-xs text-emerald-300 mt-2">{msg}</p>}
      {canManage && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => run('seed')} disabled={busy} className="text-xs px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50">
            {busy ? 'Working…' : 'Add demo profiles'}
          </button>
          {!!count && (
            <a href="/admin/demo" className="text-xs px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15">Manage photos</a>
          )}
          {!!count && (
            <button onClick={() => run('remove')} disabled={busy} className="text-xs px-3 py-2 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50">
              Remove all
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function TeamClient() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/team', { cache: 'no-store' });
    if (res.ok) setData(await res.json());
    else setError('Could not load the admin team.');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function change(action: 'appoint' | 'remove', target: { identifier?: string; userId?: string }, label: string) {
    if (action === 'remove' && !window.confirm(`Remove admin access for ${label}?`)) return;
    setBusy(target.userId ?? 'form');
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...target }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong.');
        return;
      }
      setNotice(action === 'appoint' ? `@${body.user.username} is now an admin.` : `@${body.user.username} is no longer an admin.`);
      setIdentifier('');
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-white text-2xl font-bold font-serif">Admin team</h1>
      <p className="text-white/50 text-sm mt-1">
        {data?.viewerIsSuperAdmin
          ? 'As a super admin you can appoint and remove admins. Every change is logged.'
          : 'Only a super admin can appoint or remove admins.'}
      </p>

      {error && <p role="alert" className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">{notice}</p>}

      {data?.viewerIsSuperAdmin && (
        <form
          className="glass rounded-2xl p-4 sm:p-5 mt-6 flex flex-col sm:flex-row gap-3 sm:items-end"
          onSubmit={(e) => { e.preventDefault(); if (identifier.trim()) change('appoint', { identifier: identifier.trim() }, identifier); }}
        >
          <label className="flex-1">
            <span className="text-white/70 text-sm font-medium">Appoint an admin</span>
            <input
              className="input-dark w-full mt-1.5 px-3 py-2.5 rounded-xl text-sm"
              placeholder="Username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={!identifier.trim() || busy === 'form'}
            className="btn-crimson px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserPlus size={15} aria-hidden="true" /> {busy === 'form' ? 'Appointing…' : 'Appoint admin'}
          </button>
        </form>
      )}

      <section className="glass rounded-2xl mt-6 overflow-hidden" aria-labelledby="admins-h">
        <h2 id="admins-h" className="text-white/80 text-sm font-medium px-4 sm:px-5 pt-4">
          Admins {data ? <span className="text-white/40">({data.admins.length})</span> : null}
        </h2>
        {!data ? (
          <p className="px-5 py-6 text-white/40 text-sm">Loading…</p>
        ) : (
          <ul className="divide-y divide-white/5 mt-2">
            {data.admins.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {a.profile?.profilePhoto
                    ? <ProtectedImage src={a.profile.profilePhoto} alt="" className="w-full h-full" />
                    : <span className="text-white text-xs font-bold">{a.username.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium flex items-center gap-2 flex-wrap">
                    @{a.username}
                    {a.id === data.viewerId && <span className="text-white/40 text-xs">(you)</span>}
                    {a.isSuperAdmin ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] inline-flex items-center gap-1"><Crown size={10} aria-hidden="true" /> Super admin</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#DC143C]/15 text-[#ff6b81] inline-flex items-center gap-1"><ShieldCheck size={10} aria-hidden="true" /> Admin</span>
                    )}
                    {!a.isActive && <span className="text-[11px] text-red-300">Banned</span>}
                  </p>
                  <p className="text-white/40 text-xs truncate">
                    {a.email}
                    {a.appointedAt ? ` · appointed ${when(a.appointedAt)}` : ''}
                    {a.profile?.lastSeen ? ` · last seen ${when(a.profile.lastSeen)}` : ''}
                  </p>
                </div>
                {data.viewerIsSuperAdmin && !a.isSuperAdmin && a.id !== data.viewerId && (
                  <button
                    onClick={() => change('remove', { userId: a.id }, `@${a.username}`)}
                    disabled={busy === a.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-red-500/15 hover:text-red-300 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <ShieldOff size={12} aria-hidden="true" /> Remove admin
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DemoProfilesCard />

      <section className="glass rounded-2xl mt-6 p-4 sm:p-5" aria-labelledby="log-h">
        <h2 id="log-h" className="text-white/80 text-sm font-medium flex items-center gap-2"><History size={14} aria-hidden="true" /> Admin activity</h2>
        {!data ? null : data.log.length === 0 ? (
          <p className="text-white/40 text-sm mt-3">No admin changes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.log.map((l) => (
              <li key={l.id} className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                <span className="text-white/70">
                  <span className="text-white">@{l.actor}</span>{' '}
                  {l.action === 'TIER_SET'
                    ? <>set <span className="text-white">@{l.target}</span> to {l.meta?.tier ?? '—'}</>
                    : <>{ACTION_TEXT[l.action]?.[0] ?? l.action} <span className="text-white">@{l.target}</span> {ACTION_TEXT[l.action]?.[1]}</>}
                </span>
                <span className="text-white/40 text-xs">{when(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
