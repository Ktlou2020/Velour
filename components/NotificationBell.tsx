'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check } from 'lucide-react';

interface Notification {
  id: string;
  type?: string;
  message?: string;
  title?: string;
  isRead?: boolean;
  createdAt?: string;
  link?: string;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const notifs: Notification[] = data.notifications || data || [];
        setNotifications(notifs.slice(0, 20));
        setUnreadCount(notifs.filter((n) => !n.isRead).length);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Try SSE first
    let sseConnected = false;
    try {
      const sse = new EventSource('/api/notifications/stream');
      sseRef.current = sse;

      sse.onopen = () => { sseConnected = true; };

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            setNotifications((prev) => [data.notification, ...prev].slice(0, 20));
            setUnreadCount((c) => c + 1);
          } else if (data.type === 'ping') {
            // keep-alive
          }
        } catch { /* ignore */ }
      };

      sse.onerror = () => {
        sse.close();
        sseRef.current = null;
        if (!sseConnected) {
          // Fall back to polling
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(fetchNotifications, 30000);
        }
      };
    } catch {
      // SSE not supported, fall back to polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchNotifications, 30000);
    }

    return () => {
      sseRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  async function markRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  }

  const notifIcons: Record<string, string> = {
    LIKE: '❤️',
    SUPER_LIKE: '⭐',
    MATCH: '🎉',
    MESSAGE: '💬',
    WINK: '👋',
    VIEW: '👁️',
    EVENT: '🎭',
    FORUM: '💬',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="relative w-9 h-9 glass rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-dark rounded-xl border border-white/10 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors"
                  aria-label="Mark all as read"
                >
                  <Check size={12} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell size={24} className="text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 5).map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.isRead ? 'bg-white/3' : ''}`}
                  onClick={() => {
                    markRead(notif.id);
                    if (notif.link) window.location.href = notif.link;
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {notif.type ? notifIcons[notif.type] || '🔔' : '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {notif.title && (
                        <p className="text-white text-xs font-semibold mb-0.5">{notif.title}</p>
                      )}
                      <p className="text-white/60 text-xs leading-relaxed">
                        {notif.message || 'New notification'}
                      </p>
                      {notif.createdAt && (
                        <p className="text-white/30 text-xs mt-1">{formatTime(notif.createdAt)}</p>
                      )}
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-[#DC143C] rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/5">
            <a
              href="/notifications"
              className="text-[#DC143C] hover:text-[#FF1744] text-xs font-medium transition-colors block text-center"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
