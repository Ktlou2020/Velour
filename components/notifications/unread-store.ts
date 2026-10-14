'use client';

// One live source of unread counts per browser tab, shared by the navbar bell,
// the navbar/mobile "Messages" badges and /notifications.
//
//  • SSE: /api/notifications/stream pushes `counts` and new `notification`s.
//  • Fallback: poll /api/notifications/unread every 25 s while the stream is down
//    (it reconnects with backoff).
//  • Instant refresh: call refreshUnread() (or dispatch the `hush:unread-refresh`
//    window event) after marking something read; also on tab focus and when the
//    service worker receives a push.

import { useEffect, useState } from 'react';

export interface UnreadCounts {
  notifications: number;
  unreadConversations: number;
  unreadMessages: number;
}

export interface LiveNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
}

export const UNREAD_REFRESH_EVENT = 'hush:unread-refresh';

const POLL_MS = 25000;
const ZERO: UnreadCounts = { notifications: 0, unreadConversations: 0, unreadMessages: 0 };

let counts: UnreadCounts = ZERO;
let loaded = false;
const countListeners = new Set<(c: UnreadCounts) => void>();
const notifListeners = new Set<(n: LiveNotification) => void>();
let users = 0;
let es: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
let inflight: Promise<void> | null = null;
let teardown: (() => void) | null = null;
let running = false;

function setCounts(next: UnreadCounts) {
  loaded = true;
  if (next.notifications === counts.notifications && next.unreadConversations === counts.unreadConversations && next.unreadMessages === counts.unreadMessages) return;
  counts = next;
  countListeners.forEach((l) => l(counts));
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function refreshUnread(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (inflight) return inflight;
  inflight = fetch('/api/notifications/unread', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return;
      const d = (await r.json()) as Partial<UnreadCounts>;
      setCounts({ notifications: num(d.notifications), unreadConversations: num(d.unreadConversations), unreadMessages: num(d.unreadMessages) });
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}

/** Optimistically adjust (e.g. after marking one read) — the next server count wins. */
export function adjustUnread(delta: Partial<UnreadCounts>) {
  setCounts({
    notifications: Math.max(0, counts.notifications + (delta.notifications ?? 0)),
    unreadConversations: Math.max(0, counts.unreadConversations + (delta.unreadConversations ?? 0)),
    unreadMessages: Math.max(0, counts.unreadMessages + (delta.unreadMessages ?? 0)),
  });
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => { if (document.visibilityState !== 'hidden') refreshUnread(); }, POLL_MS);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function connect() {
  if (typeof EventSource === 'undefined') { startPolling(); return; }
  es?.close();
  const src = new EventSource('/api/notifications/stream');
  es = src;
  src.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data) as { type?: string; notification?: LiveNotification } & Partial<UnreadCounts>;
      if (d.type === 'connected') {
        attempts = 0;
        stopPolling();
      } else if (d.type === 'counts') {
        setCounts({ notifications: num(d.notifications), unreadConversations: num(d.unreadConversations), unreadMessages: num(d.unreadMessages) });
      } else if (d.type === 'notification' && d.notification) {
        const n = d.notification;
        notifListeners.forEach((l) => l(n));
      }
    } catch { /* ignore malformed event */ }
  };
  src.onerror = () => {
    // Server closed (lifetime cap / deploy) or network: reconnect with backoff, poll meanwhile
    src.close();
    if (es === src) es = null;
    if (users === 0) return;
    startPolling();
    const delay = Math.min(2000 * 2 ** attempts, 60000);
    attempts++;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (users > 0) connect(); }, delay);
  };
}

function start() {
  running = true;
  refreshUnread();
  connect();
  const onRefresh = () => { refreshUnread(); };
  const onVisible = () => { if (document.visibilityState === 'visible') refreshUnread(); };
  const onSwMessage = (e: MessageEvent) => {
    const t = (e.data as { type?: string } | null)?.type;
    if (t === 'hush:push') refreshUnread();
  };
  window.addEventListener(UNREAD_REFRESH_EVENT, onRefresh);
  window.addEventListener('focus', onRefresh);
  document.addEventListener('visibilitychange', onVisible);
  const sw = typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  sw?.addEventListener('message', onSwMessage);
  teardown = () => {
    window.removeEventListener(UNREAD_REFRESH_EVENT, onRefresh);
    window.removeEventListener('focus', onRefresh);
    document.removeEventListener('visibilitychange', onVisible);
    sw?.removeEventListener('message', onSwMessage);
  };
}

function stop() {
  running = false;
  es?.close();
  es = null;
  stopPolling();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  teardown?.();
  teardown = null;
  counts = ZERO;
  loaded = false;
}

/** Live unread counts. Pass `enabled=false` while signed out. */
export function useUnreadCounts(enabled = true): UnreadCounts & { loaded: boolean } {
  const [c, setC] = useState<UnreadCounts>(counts);
  const [isLoaded, setLoaded] = useState(loaded);
  useEffect(() => {
    if (!enabled) return;
    const l = (next: UnreadCounts) => { setC(next); setLoaded(true); };
    countListeners.add(l);
    users++;
    if (!running) start();
    else { setC(counts); setLoaded(loaded); }
    return () => {
      countListeners.delete(l);
      users--;
      // Defer so a page navigation that remounts the navbar doesn't drop the stream
      setTimeout(() => { if (users === 0 && running) stop(); }, 1000);
    };
  }, [enabled]);
  return enabled ? { ...c, loaded: isLoaded } : { ...ZERO, loaded: false };
}

/** Subscribe to notifications pushed by the stream (new or bumped rows). */
export function useLiveNotifications(cb: (n: LiveNotification) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    notifListeners.add(cb);
    return () => { notifListeners.delete(cb); };
  }, [cb, enabled]);
}
