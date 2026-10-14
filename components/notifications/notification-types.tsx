'use client';

import {
  Bell, Heart, MessageCircle, Users, Eye, ShieldCheck, Star, Flame, Lock, Image as ImageIcon,
  CalendarDays, CreditCard, Sparkles, Flag, Smile, Zap,
} from 'lucide-react';

export interface TypeStyle { icon: React.ElementType; color: string; bg: string; label: string }

const S = (icon: React.ElementType, color: string, bg: string, label: string): TypeStyle => ({ icon, color, bg, label });

export const TYPE_STYLES: Record<string, TypeStyle> = {
  MESSAGE:          S(MessageCircle, 'text-sky-300',      'bg-sky-400/10',      'Message'),
  MATCH:            S(Sparkles,      'text-[#FF4D6D]',    'bg-[#DC143C]/15',    'Match'),
  LIKE:             S(Heart,         'text-rose-400',     'bg-rose-400/10',     'Like'),
  SUPERLIKE:        S(Star,          'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Super like'),
  WINK:             S(Smile,         'text-pink-300',     'bg-pink-400/10',     'Wink'),
  PROFILE_VIEW:     S(Eye,           'text-purple-300',   'bg-purple-400/10',   'Profile view'),
  COUPLE_INVITE:    S(Users,         'text-emerald-300',  'bg-emerald-400/10',  'Couple'),
  COUPLE_UPDATE:    S(Users,         'text-emerald-300',  'bg-emerald-400/10',  'Couple'),
  PHOTO_LIKE:       S(Heart,         'text-[#FF4D6D]',    'bg-[#DC143C]/10',    'Photo like'),
  ALBUM_INVITE:     S(ImageIcon,     'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Album'),
  ALBUM_REQUEST:    S(Lock,          'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Album request'),
  ALBUM_GRANTED:    S(ImageIcon,     'text-emerald-300',  'bg-emerald-400/10',  'Album'),
  REVIEW_REQUEST:   S(Star,          'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Review'),
  REVIEW_RECEIVED:  S(Star,          'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Review'),
  REVIEW_PUBLISHED: S(Star,          'text-emerald-300',  'bg-emerald-400/10',  'Review'),
  EVENT_REMINDER:   S(CalendarDays,  'text-sky-300',      'bg-sky-400/10',      'Event'),
  PAYMENT:          S(CreditCard,    'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Membership'),
  VERIFICATION:     S(ShieldCheck,   'text-emerald-300',  'bg-emerald-400/10',  'Verification'),
  VERIFIED:         S(ShieldCheck,   'text-emerald-300',  'bg-emerald-400/10',  'Verification'),
  STREAK:           S(Flame,         'text-orange-300',   'bg-orange-400/10',   'Streak'),
  REPORT:           S(Flag,          'text-red-300',      'bg-red-400/10',      'Report'),
  PRIORITY:         S(Zap,           'text-[#D4AF37]',    'bg-[#D4AF37]/10',    'Priority'),
};
export const DEFAULT_STYLE: TypeStyle = S(Bell, 'text-white/70', 'bg-white/5', 'Notification');

export function styleFor(type: string, data?: unknown): TypeStyle {
  if (type === 'MESSAGE' && data && typeof data === 'object' && (data as Record<string, unknown>).priority === true) return TYPE_STYLES.PRIORITY;
  return TYPE_STYLES[type] ?? DEFAULT_STYLE;
}

/** "Just now", "2 min ago", "3 h ago", "Yesterday", "4 days ago", then a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', ...(new Date(t).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
}

/** Section heading for grouping a list by day. */
export function dayGroup(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= start) return 'Today';
  if (t >= start - 86400000) return 'Yesterday';
  if (t >= start - 6 * 86400000) return 'This week';
  return 'Earlier';
}
