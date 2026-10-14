'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import { Bell, CheckCheck, MessageCircle } from 'lucide-react';
import { notificationHref } from '@/lib/notification-links';
import { dayGroup, styleFor, timeAgo } from '@/components/notifications/notification-types';
import { refreshUnread, useLiveNotifications, type LiveNotification } from '@/components/notifications/unread-store';

type Filter = 'all' | 'activity' | 'messages';
interface Unread { all: number; activity: number; messages: number }
interface Page { notifications?: LiveNotification[]; nextCursor?: string | null; unread?: Unread }

const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activity' },
  { id: 'messages', label: 'Messages' },
];
const PAGE = 30;

function inFilter(n: LiveNotification, f: Filter) {
  if (f === 'messages') return n.type === 'MESSAGE';
  if (f === 'activity') return n.type !== 'MESSAGE';
  return true;
}

function markRead(id: string) {
  return fetch('/api/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationId: id }),
    keepalive: true,
  }).catch(() => null);
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<LiveNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState<Unread>({ all: 0, activity: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const load = useCallback(async (f: Filter, after?: string | null) => {
    const qs = new URLSearchParams({ filter: f, limit: String(PAGE) });
    if (after) qs.set('cursor', after);
    const res = await fetch(`/api/notifications?${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Page;
  }, []);

  const reload = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(false);
    try {
      const d = await load(f);
      if (filterRef.current !== f) return;
      setItems(d.notifications ?? []);
      setCursor(d.nextCursor ?? null);
      if (d.unread) setUnread(d.unread);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    let f: Filter = 'all';
    try {
      const q = new URLSearchParams(window.location.search).get('filter');
      if (q === 'activity' || q === 'messages') f = q;
    } catch { /* ignore */ }
    setFilter(f);
    reload(f);
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [reload]);

  function pickFilter(f: Filter) {
    if (f === filter) return;
    setFilter(f);
    setItems([]);
    try { window.history.replaceState({}, '', f === 'all' ? '/notifications' : `/notifications?filter=${f}`); } catch { /* ignore */ }
    reload(f);
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await load(filter, cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...(d.notifications ?? []).filter((n) => !seen.has(n.id))];
      });
      setCursor(d.nextCursor ?? null);
    } catch { /* keep the button */ }
    finally { setLoadingMore(false); }
  }

  // Live: new or bumped notifications go to the top
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onLive = useCallback((n: LiveNotification) => {
    if (!inFilter(n, filterRef.current)) return;
    const had = itemsRef.current.find((x) => x.id === n.id);
    if (!had || had.isRead) {
      setUnread((u) => ({
        all: u.all + 1,
        activity: u.activity + (n.type !== 'MESSAGE' ? 1 : 0),
        messages: u.messages + (n.type === 'MESSAGE' ? 1 : 0),
      }));
    }
    setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
  }, []);
  useLiveNotifications(onLive);

  function onOpen(n: LiveNotification) {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setUnread((u) => ({
      all: Math.max(0, u.all - 1),
      activity: Math.max(0, u.activity - (n.type !== 'MESSAGE' ? 1 : 0)),
      messages: Math.max(0, u.messages - (n.type === 'MESSAGE' ? 1 : 0)),
    }));
    markRead(n.id).then(() => refreshUnread());
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, filter }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnread((u) => filter === 'all'
          ? { all: 0, activity: 0, messages: 0 }
          : filter === 'activity'
            ? { all: Math.max(0, u.all - u.activity), activity: 0, messages: u.messages }
            : { all: Math.max(0, u.all - u.messages), activity: u.activity, messages: 0 });
        refreshUnread();
      }
    } finally {
      setMarkingAll(false);
    }
  }

  const tabUnread = unread[filter];

  // Group by day, keeping the server's newest-first order
  const groups: { label: string; items: LiveNotification[] }[] = [];
  const nowDate = new Date(now);
  for (const n of items) {
    const label = dayGroup(n.createdAt, nowDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main id="main-content" className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-white text-3xl font-bold font-serif">Notifications</h1>
            <p className="text-white/60 text-sm mt-0.5" aria-live="polite">
              {unread.all > 0 ? `${unread.all} unread` : 'You’re all caught up'}
            </p>
          </div>
          {tabUnread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-sm glass px-4 py-2 rounded-xl text-white/70 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <CheckCheck size={14} aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Filter notifications" className="flex gap-2 mb-5">
          {TABS.map((t) => {
            const active = t.id === filter;
            const count = unread[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pickFilter(t.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? 'bg-white text-[#0A0A0F]' : 'glass text-white/70 hover:text-white'}`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center ${active ? 'bg-[#DC143C] text-white' : 'bg-[#DC143C]/80 text-white'}`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-2xl h-[76px] skeleton" />)}
          </div>
        ) : error && items.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center" role="alert">
            <p className="text-white font-medium">Couldn’t load notifications</p>
            <p className="text-white/60 text-sm mt-1 mb-4">Check your connection and try again.</p>
            <button type="button" onClick={() => reload(filter)} className="bg-[#DC143C] hover:bg-[#FF1744] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">Try again</button>
          </div>
        ) : items.length === 0 ? (
          filter === 'messages' ? (
            <EmptyState
              icon={MessageCircle}
              title="No message alerts"
              description="When someone writes to you, it shows up here and on the Messages tab."
              action={{ label: 'Open messages', href: '/messages' }}
            />
          ) : (
            <EmptyState
              icon={Bell}
              title="All quiet for now"
              description="Likes, matches, profile views and event reminders will appear here. A few likes in Discover usually gets things going."
              action={{ label: 'Start discovering', href: '/discover' }}
            />
          )
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h2 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{g.label}</h2>
                <ul className="space-y-2">
                  {g.items.map((n) => {
                    const st = styleFor(n.type, n.data);
                    const Icon = st.icon;
                    return (
                      <li key={n.id}>
                        <Link
                          href={notificationHref(n)}
                          onClick={() => onOpen(n)}
                          data-notification-type={n.type}
                          className={`flex items-start gap-4 glass rounded-2xl p-4 transition-all hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DC143C] ${!n.isRead ? 'border border-white/15 bg-white/5' : 'opacity-75 hover:opacity-100'}`}
                        >
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${st.bg} ${st.color}`}>
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm leading-snug ${n.isRead ? 'text-white/85 font-medium' : 'text-white font-semibold'}`}>{n.title}</span>
                            {n.body && <span className="block text-white/65 text-xs mt-0.5 leading-relaxed line-clamp-2 break-words">{n.body}</span>}
                            <span className="block text-white/50 text-xs mt-1">
                              <span className="sr-only">{st.label} · </span>
                              <time dateTime={n.createdAt}>{timeAgo(n.createdAt, now)}</time>
                            </span>
                          </span>
                          {!n.isRead && (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#DC143C] flex-shrink-0 mt-1.5" role="img" aria-label="Unread" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {cursor && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="glass px-5 py-2 rounded-xl text-sm text-white/75 hover:text-white transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
