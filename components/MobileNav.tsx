'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Home, Compass, MessageCircle, Images, User } from 'lucide-react';
import { useSparkToday } from './spark/useSparkToday';
import { useUnreadCounts } from './notifications/unread-store';

// Explore (the public photo gallery) earns a tab; Spark and Events live in the
// menu and on the Members page.
// `tour`: the data-tour anchor the first-run tour spotlights on mobile.
const TABS: { href: string; label: string; icon: typeof Home; tour: string; showBadge?: boolean; sparkDot?: boolean }[] = [
  { href: '/members', tour: 'members', label: 'Home', icon: Home },
  { href: '/discover', tour: 'discover', label: 'Discover', icon: Compass },
  { href: '/gallery/explore', tour: 'explore', label: 'Explore', icon: Images },
  { href: '/messages', tour: 'messages', label: 'Messages', icon: MessageCircle, showBadge: true },
  { href: '/profile', tour: 'profile', label: 'Profile', icon: User },
];

const HIDDEN_ON = ['/onboarding', '/auth', '/admin'];

export default function MobileNav() {
  const pathname = usePathname();
  const { status } = useSession();
  // Messages tab badge = unread MESSAGES (ConversationParticipant.unreadCount,
  // live via the shared SSE store) — not the notification count.
  const { unreadMessages: unread } = useUnreadCounts(status === 'authenticated');
  const spark = useSparkToday();
  const sparkPending = !!spark && !spark.answered;

  if (status !== 'authenticated') return null;
  // Focused flows (onboarding, auth, admin) get the full screen.
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
    {/* In-flow spacer so the last bit of every page can scroll clear of the fixed bar */}
    <div aria-hidden="true" className="md:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom))' }} />
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-dark border-t border-white/10 pb-safe"
      aria-label="Primary"
    >
      <div className="flex items-stretch h-16">
        {TABS.map(({ href, label, icon: Icon, tour, showBadge, sparkDot }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-tour={tour}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              aria-label={showBadge && unread > 0 ? `${label} (${unread} unread message${unread === 1 ? '' : 's'})` : sparkDot && sparkPending ? `${label} (new question)` : label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={`transition-colors ${isActive ? 'text-[#DC143C]' : 'text-white/60'}`}
                  aria-hidden="true"
                />
                {sparkDot && sparkPending && (
                  <span aria-hidden="true" className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#D4AF37] border border-[#0A0A0F]" />
                )}
                {showBadge && unread > 0 && (
                  <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-white/60'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#DC143C] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
