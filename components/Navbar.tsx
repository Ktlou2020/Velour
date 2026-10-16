'use client';

import { useState } from 'react';
import { STORE_NAME } from '@/lib/store/config';
import Logo from './Logo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, ChevronDown, LogOut, User, Crown, MessageCircle, Eye, Shield, CreditCard, ShieldCheck, BarChart3, CalendarDays, MessagesSquare, Bell , ShoppingBag, Map as MapIcon, Gift } from 'lucide-react';
import { startTour } from './tour/events';
import NotificationBell from './NotificationBell';
import { useUnreadCounts } from './notifications/unread-store';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import { useSparkToday } from './spark/useSparkToday';

// `wide`: only shown in the desktop bar from xl up (they move into the account menu below that).
// `tour`: the data-tour anchor the first-run tour spotlights (components/tour).
const NAV_LINKS: { href: string; label: string; showBadge?: boolean; sparkDot?: boolean; wide?: boolean; tour?: string }[] = [
  { href: '/members', label: 'Members', tour: 'members' },
  { href: '/discover', label: 'Discover', tour: 'discover' },
  { href: '/spark', label: 'Spark', sparkDot: true },
  { href: '/matches', label: 'Matches' },
  { href: '/messages', label: 'Messages', showBadge: true, tour: 'messages' },
  { href: '/gallery/explore', label: 'Explore', tour: 'explore' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/events', label: 'Events', wide: true },
  { href: '/forums', label: 'Forums', wide: true },
  { href: '/store', label: STORE_NAME, wide: true },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const spark = useSparkToday();
  const sparkPending = !!spark && !spark.answered;

  const isActive = (href: string) =>
    href === '/gallery'
      ? pathname.startsWith('/gallery') && !pathname.startsWith('/gallery/explore')
      : pathname.startsWith(href);

  const username = (session?.user as { username?: string })?.username ?? session?.user?.email ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';
  const userRole = (session?.user as { role?: string })?.role;

  // Live counts (SSE + polling fallback) shared with the bell and the mobile tab bar.
  // Messages badge = unread messages (ConversationParticipant.unreadCount), not notifications.
  const { unreadMessages, notifications: unreadNotifications } = useUnreadCounts(status === 'authenticated');

  return (
    <>
    <div className="fixed top-0 left-0 right-0 z-40">
    <nav className="glass-dark border-b border-white/5" aria-label="Main">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Logo */}
          <Logo href={session ? '/members' : '/'} />

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, showBadge, sparkDot, wide, tour }) => (
              <Link
                key={href}
                href={href}
                data-tour={tour}
                aria-label={sparkDot && sparkPending ? `${label} (today's question is waiting)` : undefined}
                className={`relative ${wide ? 'hidden xl:inline-flex' : 'inline-flex'} px-2.5 xl:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(href) ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
                {sparkDot && sparkPending && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
                )}
                {showBadge && unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3 ml-auto mr-2 lg:mr-0">
            {status === 'loading' ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-8 rounded-lg bg-white/5 animate-pulse" />
                <div className="w-24 h-8 rounded-lg bg-white/5 animate-pulse" />
              </div>
            ) : status === 'authenticated' ? (
              <>
                <div data-tour="notifications" className="rounded-lg">
                  <NotificationBell />
                </div>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg hover:border-white/20 transition-all"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                    data-tour="profile"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8F0D25] to-[#DC143C] flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <span className="text-white text-sm font-medium max-w-24 truncate">{username}</span>
                    <ChevronDown size={14} className={`text-white/65 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
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
                        href="/insights"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <BarChart3 size={14} />Profile insights
                      </Link>
                      <Link
                        href="/events"
                        className="flex xl:hidden items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <CalendarDays size={14} />Events
                      </Link>
                      <Link
                        href="/forums"
                        className="flex xl:hidden items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <MessagesSquare size={14} />Forums
                      </Link>
                      <Link
                        href="/store"
                        className="flex xl:hidden items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShoppingBag size={14} />{STORE_NAME}
                      </Link>
                      <Link
                        href="/views"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Eye size={14} />Who Viewed Me
                      </Link>
                      <Link
                        href="/safety"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShieldCheck size={14} />Safety Centre
                      </Link>
                      <Link
                        href="/invite"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Gift size={14} />Invite friends
                      </Link>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => { setUserMenuOpen(false); startTour(); }}
                      >
                        <MapIcon size={14} />Take the tour
                      </button>
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

          {/* Mobile: bell → /notifications (the dropdown bell lives in the md+ bar) */}
          {status === 'authenticated' && (
            <Link
              href="/notifications"
              data-tour="notifications"
              className="md:hidden relative w-10 h-10 ml-auto flex items-center justify-center rounded-lg text-white/70 hover:text-white"
              aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
              aria-current={pathname.startsWith('/notifications') ? 'page' : undefined}
            >
              <Bell size={20} aria-hidden="true" />
              {unreadNotifications > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-0.5 min-w-4 h-4 bg-[#DC143C] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          )}

          {/* Mobile Toggle */}
          <button
            className="lg:hidden text-white/80 hover:text-white w-10 h-10 -mr-2 flex items-center justify-center rounded-lg"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            data-tour="menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden glass-dark border-t border-white/5 px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label, showBadge, sparkDot }) => (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href) ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {label}
              {sparkDot && sparkPending && (
                <span className="ml-2 text-[10px] font-semibold text-[#D4AF37]">New question</span>
              )}
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
                  href="/notifications"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <Bell size={14} />Notifications
                  {unreadNotifications > 0 && (
                    <span className="ml-auto min-w-5 h-5 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                      {unreadNotifications}
                    </span>
                  )}
                </Link>
                <Link
                  href="/views"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <Eye size={14} />Who Viewed Me
                </Link>
                <Link
                  href="/safety"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <ShieldCheck size={14} />Safety Centre
                </Link>
                <Link
                  href="/invite"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <Gift size={14} />Invite friends
                </Link>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-lg text-white/70 text-sm text-left"
                  onClick={() => { setMobileOpen(false); startTour(); }}
                >
                  <MapIcon size={14} />Take the tour
                </button>
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
    </div>
    {session && <ProfileCompletionBanner />}
    </>
  );
}
