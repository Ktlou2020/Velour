'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, ChevronDown, LogOut, User, Crown, MessageCircle, Eye, Shield, CreditCard } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface NavConversationCount {
  unreadCount: number;
}

const NAV_LINKS = [
  { href: '/members', label: 'Members' },
  { href: '/discover', label: 'Discover' },
  { href: '/messages', label: 'Messages', showBadge: true },
  { href: '/gallery', label: 'Gallery' },
  { href: '/events', label: 'Events' },
  { href: '/forums', label: 'Forums' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (href: string) => pathname.startsWith(href);

  const username = (session?.user as { username?: string })?.username ?? session?.user?.email ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';
  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status !== 'authenticated') return;
    async function fetchUnread() {
      try {
        const res = await fetch('/api/conversations');
        if (res.ok) {
          const data = await res.json();
          const conversations: NavConversationCount[] = data.conversations || data || [];
          const total = conversations.reduce((sum: number, c: NavConversationCount) => sum + (c.unreadCount || 0), 0);
          setUnreadMessages(total);
        }
      } catch { /* ignore */ }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="Velour home">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-bold text-lg font-serif">V</span>
            </div>
            <span className="text-white font-bold text-xl tracking-widest font-serif">VELOUR</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, showBadge }) => (
              <Link
                key={href}
                href={href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(href) ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
                {showBadge && unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {status === 'loading' ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-8 rounded-lg bg-white/5 animate-pulse" />
                <div className="w-24 h-8 rounded-lg bg-white/5 animate-pulse" />
              </div>
            ) : status === 'authenticated' ? (
              <>
                <NotificationBell />

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg hover:border-white/20 transition-all"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8F0D25] to-[#DC143C] flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <span className="text-white text-sm font-medium max-w-24 truncate">{username}</span>
                    <ChevronDown size={14} className={`text-white/50 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 glass-dark rounded-xl border border-white/10 py-2 shadow-xl z-50">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={14} />My Profile
                      </Link>
                      <Link
                        href="/messages"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <MessageCircle size={14} />
                        Messages
                        {unreadMessages > 0 && (
                          <span className="ml-auto min-w-5 h-5 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                            {unreadMessages}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/upgrade"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Crown size={14} />Upgrade
                      </Link>
                      <Link
                        href="/subscription"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <CreditCard size={14} />Subscription
                      </Link>
                      <Link
                        href="/views"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Eye size={14} />Who Viewed Me
                      </Link>
                      {userRole === 'ADMIN' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Shield size={14} />Admin Dashboard
                        </Link>
                      )}
                      <div className="my-1 border-t border-white/10" />
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-[#DC143C] hover:bg-[#DC143C]/10 text-sm transition-colors"
                        onClick={() => { setUserMenuOpen(false); window.location.href = '/api/logout' }}
                      >
                        <LogOut size={14} />Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-white/70 hover:text-white text-sm font-medium border border-white/20 hover:border-white/40 px-4 py-2 rounded-lg transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white text-sm px-5 py-2 rounded-lg font-semibold transition-all"
                >
                  Join Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-white/80 hover:text-white p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden glass-dark border-t border-white/5 px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label, showBadge }) => (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href) ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {label}
              {showBadge && unreadMessages > 0 && (
                <span className="ml-2 min-w-5 h-5 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                  {unreadMessages}
                </span>
              )}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            {status === 'authenticated' ? (
              <>
                <Link
                  href="/profile"
                  className="block text-center glass border border-white/20 px-4 py-2 rounded-lg text-white text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  My Profile
                </Link>
                <Link
                  href="/upgrade"
                  className="block text-center glass border border-[#D4AF37]/20 px-4 py-2 rounded-lg text-[#D4AF37] text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  Upgrade
                </Link>
                <Link
                  href="/subscription"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <CreditCard size={14} />Subscription
                </Link>
                <Link
                  href="/views"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <Eye size={14} />Who Viewed Me
                </Link>
                {userRole === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Shield size={14} />Admin Dashboard
                  </Link>
                )}
                <button
                  className="text-[#DC143C] text-sm py-2 text-center w-full"
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: '/' }) }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-center text-white/80 border border-white/20 px-4 py-2.5 rounded-lg text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white text-center px-4 py-2.5 rounded-lg text-sm font-semibold"
                  onClick={() => setMobileOpen(false)}
                >
                  Join Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
