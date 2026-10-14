'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Home, Compass, MessageCircle, Images, User } from 'lucide-react';
import { useSparkToday } from './spark/useSparkToday';

// Explore (the public photo gallery) earns a tab; Spark and Events live in the
// menu and on the Members page.
const TABS: { href: string; label: string; icon: typeof Home; showBadge?: boolean; sparkDot?: boolean }[] = [
  { href: '/members', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/gallery/explore', label: 'Explore', icon: Images },
  { href: '/messages', label: 'Messages', icon: MessageCircle, showBadge: true },
  { href: '/profile', label: 'Profile', icon: User },
];

const HIDDEN_ON = ['/onboarding', '/auth', '/admin'];

export default function MobileNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const [unread, setUnread] = useState(0);
  const spark = useSparkToday();
  const sparkPending = !!spark && !spark.answered;

  useEffect(() => {
    if (status !== 'authenticated') return;

    async function fetchUnread() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setUnread(data.unreadCount ?? data.count ?? 0);
        }
      } catch { /* ignore */ }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [status]);

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
        {TABS.map(({ href, label, icon: Icon, showBadge, sparkDot }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              aria-label={showBadge && unread > 0 ? `${label} (${unread} unread)` : sparkDot && sparkPending ? `${label} (new question)` : label}
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
                  <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
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
