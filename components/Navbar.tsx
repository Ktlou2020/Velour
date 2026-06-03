'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Menu, X, Bell, ChevronDown, LogOut, User, Crown } from 'lucide-react';

const NAV_LINKS = [
  { href: '/members', label: 'Members' },
  { href: '/discover', label: 'Discover' },
  { href: '/events', label: 'Events' },
  { href: '/forums', label: 'Forums' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (href: string) => pathname.startsWith(href);

  const username = (session?.user as { username?: string })?.username ?? session?.user?.email ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="Velour home">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
              <span className="text-white font-bold text-lg font-serif">V</span>
            </div>
            <span className="text-white font-bold text-xl tracking-widest">VELOUR</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(href)
                    ? 'text-white bg-white/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
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
                {/* Notifications */}
                <button
                  className="relative w-9 h-9 glass rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#DC143C] rounded-full" />
                </button>

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
                    <span className="text-white text-sm font-medium">{username}</span>
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
                        Messages
                      </Link>
                      <Link
                        href="/upgrade"
                        className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Crown size={14} />Upgrade
                      </Link>
                      <div className="my-1 border-t border-white/10" />
                      <Link
                        href="/auth/signout"
                        className="w-full flex items-center gap-2 px-4 py-2 text-[#DC143C] hover:bg-[#DC143C]/10 text-sm transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <LogOut size={14} />Sign Out
                      </Link>
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
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href) ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {label}
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
                  href="/auth/signout"
                  className="text-[#DC143C] text-sm py-2 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign Out
                </Link>
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
