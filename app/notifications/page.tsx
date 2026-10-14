'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import EmptyState from '@/components/EmptyState';
import { Bell, Heart, MessageCircle, Users, Eye, Shield, Star, Check, CheckCheck, Flame } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; href?: (n: Notification) => string }> = {
  MATCH:        { icon: Heart,          color: 'text-[#DC143C]',  href: () => '/messages' },
  LIKE:         { icon: Heart,          color: 'text-rose-400',   href: () => '/members' },
  SUPERLIKE:    { icon: Star,           color: 'text-[#D4AF37]',  href: () => '/members' },
  WINK:         { icon: Heart,          color: 'text-pink-400',   href: () => '/members' },
  MESSAGE:      { icon: MessageCircle,  color: 'text-blue-400',   href: () => '/messages' },
  PROFILE_VIEW: { icon: Eye,            color: 'text-purple-400', href: () => '/members' },
  COUPLE_INVITE:{ icon: Users,          color: 'text-emerald-400',href: () => '/profile' },
  VERIFIED:     { icon: Shield,         color: 'text-emerald-400',href: () => '/account' },
  STREAK:       { icon: Flame,          color: 'text-orange-400', href: () => '/account' },
  DEFAULT:      { icon: Bell,           color: 'text-white/65' },
};

function fmtTime(d: string) {
  const dt = new Date(d), now = new Date(), diff = now.getTime() - dt.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return dt.toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((d: { notifications?: Notification[] }) => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    }).catch(() => {});
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-3xl font-bold font-serif">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-white/60 text-sm mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-sm glass px-4 py-2 rounded-xl text-white/60 hover:text-white transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl h-[76px] skeleton" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="All quiet for now"
            description="Likes, matches, messages and event reminders will appear here. A few likes in Discover usually gets things going."
            action={{ label: 'Start discovering', href: '/discover' }}
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.DEFAULT;
              const Icon = cfg.icon;
              const href = cfg.href?.(n);

              const inner = (
                <div
                  className={`flex items-start gap-4 glass rounded-2xl p-4 transition-all ${!n.isRead ? 'border border-white/10 bg-white/5' : 'opacity-70'} hover:opacity-100`}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <div className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-snug">{n.title}</p>
                    <p className="text-white/65 text-xs mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-white/50 text-xs mt-1">{fmtTime(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-[#DC143C]" role="img" aria-label="Unread" />
                    )}
                    {n.isRead && (
                      <Check size={14} className="text-white/45" />
                    )}
                  </div>
                </div>
              );

              return href ? (
                <Link key={n.id} href={href} onClick={() => !n.isRead && markRead(n.id)}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
