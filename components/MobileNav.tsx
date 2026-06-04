'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Home, Compass, MessageCircle, CalendarDays, User } from 'lucide-react';

const TABS = [
  { href: '/members', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/messages', label: 'Messages', icon: MessageCircle, showBadge: true },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const [unread, setUnread] = useState(0);

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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-dark border-t border-white/10"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch h-16">
        {TABS.map(({ href, label, icon: Icon, showBadge }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={`transition-colors ${isActive ? 'text-[#DC143C]' : 'text-white/40'}`}
                />
                {showBadge && unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[#DC143C]' : 'text-white/40'
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
  );
}
