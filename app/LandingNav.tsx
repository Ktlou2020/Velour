'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export default function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/20">
              <span className="text-white font-bold text-lg font-serif">V</span>
            </div>
            <span className="text-white font-bold text-xl tracking-widest font-serif">VELOUR</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-white/60 hover:text-white text-sm transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-white/60 hover:text-white text-sm transition-colors">How It Works</Link>
            <Link href="#pricing" className="text-white/60 hover:text-white text-sm transition-colors">Pricing</Link>
            <Link href="/auth/signin" className="text-white/70 hover:text-white text-sm transition-colors">Sign In</Link>
            <Link href="/auth/signup" className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#DC143C]/20">
              Join Free
            </Link>
          </div>

          <button className="md:hidden text-white/70 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass-dark border-t border-white/5 py-4 px-6 space-y-3">
          <Link href="#features" className="block text-white/70 hover:text-white text-sm py-2" onClick={() => setMobileOpen(false)}>Features</Link>
          <Link href="#how-it-works" className="block text-white/70 hover:text-white text-sm py-2" onClick={() => setMobileOpen(false)}>How It Works</Link>
          <Link href="#pricing" className="block text-white/70 hover:text-white text-sm py-2" onClick={() => setMobileOpen(false)}>Pricing</Link>
          <Link href="/auth/signin" className="block text-white/70 hover:text-white text-sm py-2" onClick={() => setMobileOpen(false)}>Sign In</Link>
          <Link href="/auth/signup" className="block bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white px-5 py-2.5 rounded-xl text-sm font-semibold text-center" onClick={() => setMobileOpen(false)}>
            Join Free
          </Link>
        </div>
      )}
    </nav>
  );
}
