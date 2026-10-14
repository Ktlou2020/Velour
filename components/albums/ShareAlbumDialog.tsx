'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, UserPlus, X, Users, Clock } from 'lucide-react';
import Modal from './Modal';
import { api, type AccessEntry, type PersonSummary } from '@/components/gallery/types';
import { Avatar, Spinner, btnPrimary } from '@/components/gallery/ui';
import { useToast } from '@/lib/toast-context';

interface Props {
  open: boolean;
  onClose: () => void;
  album: { id: string; name: string; isPrivate: boolean };
  /** Called when the access list changes (counts on the album card). */
  onChanged?: (counts: { granted: number; pending: number }) => void;
}

export default function ShareAlbumDialog({ open, onClose, album, onChanged }: Props) {
  const { showToast } = useToast();
  const [granted, setGranted] = useState<AccessEntry[]>([]);
  const [requests, setRequests] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PersonSummary[]>([]);
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputId = useId();
  const listId = useId();
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ granted: AccessEntry[]; requests: AccessEntry[] }>(`/api/albums/${album.id}/access`);
      setGranted(d.granted);
      setRequests(d.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [album.id]);

  useEffect(() => { if (open) { setError(''); setQuery(''); load(); } }, [open, load]);
  useEffect(() => {
    if (!loading) onChangedRef.current?.({ granted: granted.length, pending: requests.length });
  }, [granted.length, requests.length, loading]);

  // Suggestions: matches / chat partners, plus an exact username.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      try {
        const d = await api<{ people: PersonSummary[] }>(`/api/albums/people?q=${encodeURIComponent(q)}`);
        const have = new Set(granted.map((g) => g.id));
        setSuggestions(d.people.filter((p) => !have.has(p.id)).slice(0, 6));
      } catch { setSuggestions([]); }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, open, granted]);

  async function invite(username: string) {
    const name = username.trim().replace(/^@/, '');
    if (!name) return;
    setInviting(true);
    setError('');
    try {
      const d = await api<{ member: AccessEntry; alreadyShared?: boolean }>(`/api/albums/${album.id}/access`, { method: 'POST', json: { username: name } });
      setQuery('');
      setRequests((r) => r.filter((x) => x.id !== d.member.id));
      setGranted((g) => (g.some((x) => x.id === d.member.id) ? g : [{ ...d.member, since: new Date().toISOString() }, ...g]));
      showToast(d.alreadyShared ? `@${d.member.username} already has access` : `Shared with @${d.member.username}`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setInviting(false);
    }
  }

  async function answer(person: AccessEntry, action: 'approve' | 'decline') {
    setBusyId(person.id);
    try {
      await api(`/api/albums/${album.id}/access/${person.id}`, { method: 'PATCH', json: { action } });
      setRequests((r) => r.filter((x) => x.id !== person.id));
      if (action === 'approve') setGranted((g) => [{ ...person, status: 'GRANTED' }, ...g]);
      showToast(action === 'approve' ? `@${person.username} can now see this album` : 'Request declined', action === 'approve' ? 'success' : 'info');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(person: AccessEntry) {
    setBusyId(person.id);
    try {
      await api(`/api/albums/${album.id}/access/${person.id}`, { method: 'DELETE' });
      setGranted((g) => g.filter((x) => x.id !== person.id));
      showToast(`Removed @${person.username}`, 'info');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share “${album.name}”`}
      description={album.isPrivate
        ? 'People you add can see this private album straight away. They can leave at any time, and you can remove them at any time.'
        : 'This album is public. Make it private to choose exactly who can see it.'}
    >
      {album.isPrivate && (
        <form
          onSubmit={(e) => { e.preventDefault(); invite(query); }}
          className="mb-5"
        >
          <label htmlFor={inputId} className="block text-white/70 text-xs font-medium mb-1.5">Add a member by username</label>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
              <input
                id={inputId}
                data-autofocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
                aria-controls={listId}
                className="input-dark w-full pl-7"
              />
            </div>
            <button type="submit" disabled={inviting || !query.trim()} className={btnPrimary}>
              {inviting ? <Spinner /> : <UserPlus size={15} aria-hidden="true" />} Share
            </button>
          </div>
          {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
          {suggestions.length > 0 && (
            <ul id={listId} aria-label="Suggestions" className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => invite(p.username)}
                    disabled={inviting}
                    className="flex items-center gap-2 glass border border-white/10 hover:border-[#D4AF37]/50 rounded-full pl-1 pr-3 py-1 text-sm text-white/85 transition-colors"
                    aria-label={`Share with ${p.displayName} (@${p.username})`}
                  >
                    <Avatar url={p.avatarUrl} name={p.displayName} size={24} />
                    <span className="truncate max-w-[9rem]">{p.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl skeleton" />)}
        </div>
      ) : (
        <>
          {requests.length > 0 && (
            <section aria-labelledby="req-h" className="mb-5">
              <h3 id="req-h" className="flex items-center gap-1.5 text-white/80 text-sm font-semibold mb-2">
                <Clock size={14} className="text-[#D4AF37]" aria-hidden="true" /> Requests ({requests.length})
              </h3>
              <ul className="space-y-2">
                {requests.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 glass rounded-xl px-3 py-2">
                    <Avatar url={p.avatarUrl} name={p.displayName} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{p.displayName}</p>
                      <p className="text-white/50 text-xs truncate">@{p.username}</p>
                    </div>
                    <button type="button" disabled={busyId === p.id} onClick={() => answer(p, 'approve')} aria-label={`Approve @${p.username}`} className="p-2 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                      <Check size={16} aria-hidden="true" />
                    </button>
                    <button type="button" disabled={busyId === p.id} onClick={() => answer(p, 'decline')} aria-label={`Decline @${p.username}`} className="p-2 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50">
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="acc-h">
            <h3 id="acc-h" className="flex items-center gap-1.5 text-white/80 text-sm font-semibold mb-2">
              <Users size={14} className="text-[#FF4D6D]" aria-hidden="true" /> People with access ({granted.length})
            </h3>
            {granted.length === 0 ? (
              <p className="text-white/50 text-sm py-3">{album.isPrivate ? 'Only you can see this album right now.' : 'No one has been added.'}</p>
            ) : (
              <ul className="space-y-2">
                {granted.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 glass rounded-xl px-3 py-2">
                    <Avatar url={p.avatarUrl} name={p.displayName} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{p.displayName}</p>
                      <p className="text-white/50 text-xs truncate">@{p.username}</p>
                    </div>
                    <button type="button" disabled={busyId === p.id} onClick={() => revoke(p)} className="text-xs text-white/60 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50" aria-label={`Remove access for @${p.username}`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}
