'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy & safety' },
  { href: '#pricing', label: 'Membership' },
];

export default function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled || mobileOpen ? 'glass-dark border-b border-white/5' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav aria-label="Main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <div className="hidden md:flex items-center gap-7">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-white/70 hover:text-white text-sm transition-colors">
                {l.label}
              </a>
            ))}
            <Link href="/auth/signin" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#DC143C]/20"
            >
              Join free
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link href="/auth/signin" className="text-white/85 text-sm font-medium px-3 py-2">
              Sign in
            </Link>
            <button
              className="w-10 h-10 -mr-2 flex items-center justify-center text-white/80 hover:text-white rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="landing-mobile-menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div id="landing-mobile-menu" className="md:hidden border-t border-white/5 px-4 pt-2 pb-5 space-y-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-white/80 hover:text-white text-base py-3 px-2 rounded-lg hover:bg-white/5"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/auth/signup"
            className="mt-3 block bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white px-5 py-3 rounded-xl text-base font-semibold text-center"
            onClick={() => setMobileOpen(false)}
          >
            Join free
          </Link>
        </div>
      )}
    </header>
  );
}
