'use client';

// Navbar bell: unread ACTIVITY notifications (likes, matches, views, couple,
// albums, reviews, events, …). Messages are deliberately excluded — they have
// their own badge on "Messages" — so nothing is counted twice. The full list
// (messages included) lives on /notifications.

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCheck } from 'lucide-react';
import { notificationHref } from '@/lib/notification-links';
import { styleFor, timeAgo } from './notifications/notification-types';
import { adjustUnread, refreshUnread, useLiveNotifications, useUnreadCounts, type LiveNotification } from './notifications/unread-store';

const SHOW = 8;

export function markNotificationRead(id: string) {
  return fetch('/api/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationId: id }),
    keepalive: true,
  }).catch(() => null);
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LiveNotification[] | null>(null);
  const { notifications: unreadCount } = useUnreadCounts(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?filter=activity&limit=${SHOW}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { notifications?: LiveNotification[] };
        setItems(data.notifications ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  // New / bumped activity while the dropdown has been loaded
  const onLive = useCallback((n: LiveNotification) => {
    if (n.type === 'MESSAGE') return;
    setItems((prev) => (prev ? [n, ...prev.filter((x) => x.id !== n.id)].slice(0, SHOW) : prev));
  }, []);
  useLiveNotifications(onLive);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function markAllRead() {
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? prev);
    adjustUnread({ notifications: -unreadCount });
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, filter: 'activity' }),
    }).catch(() => {});
    refreshUnread();
  }

  function openItem(n: LiveNotification) {
    if (!n.isRead) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? prev);
      adjustUnread({ notifications: -1 });
      markNotificationRead(n.id).then(() => refreshUnread());
    }
    setOpen(false);
    router.push(notificationHref(n));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative w-9 h-9 glass rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={16} aria-hidden="true" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] glass-dark rounded-xl border border-white/10 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-white/60 hover:text-white text-xs flex items-center gap-1 transition-colors">
                  <CheckCheck size={12} aria-hidden="true" />
                  Mark all read
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors" aria-label="Close notifications">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {items === null ? (
              <div className="p-3 space-y-2" aria-hidden="true">
                {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Bell size={24} className="text-white/15 mx-auto mb-2" aria-hidden="true" />
                <p className="text-white/60 text-sm">Nothing new yet</p>
                <p className="text-white/45 text-xs mt-1">Likes, matches and views show up here.</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const st = styleFor(n.type, n.data);
                  const Icon = st.icon;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex items-start gap-3 ${!n.isRead ? 'bg-white/[0.03]' : ''}`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${st.bg} ${st.color}`}>
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-xs leading-snug ${n.isRead ? 'text-white/75' : 'text-white font-semibold'}`}>{n.title}</span>
                          {n.body && <span className="block text-white/60 text-xs leading-relaxed mt-0.5 line-clamp-2">{n.body}</span>}
                          <span className="block text-white/45 text-[11px] mt-1">{timeAgo(n.createdAt)}</span>
                        </span>
                        {!n.isRead && <span className="w-2 h-2 bg-[#DC143C] rounded-full flex-shrink-0 mt-1.5" aria-label="Unread" role="img" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-t border-white/5">
            <Link href="/notifications" className="text-[#FF4D6D] hover:text-[#FF1744] text-xs font-medium transition-colors block text-center" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
