'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background blur circles */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 animate-pulse"
        style={{ background: 'radial-gradient(circle, #DC143C 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10 animate-pulse"
        style={{ background: 'radial-gradient(circle, #8F0D25 0%, transparent 70%)', animationDelay: '1.5s' }}
      />

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-12" aria-label="Velour home">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/25">
            <span className="text-white font-bold text-xl font-serif">V</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-widest font-serif">VELOUR</span>
        </Link>

        {/* 500 */}
        <h1
          className="font-serif font-bold mb-4 select-none"
          style={{
            fontSize: 'clamp(6rem, 20vw, 10rem)',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #DC143C 0%, #FF4D6D 50%, #8F0D25 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          500
        </h1>

        <h2 className="font-serif text-2xl md:text-3xl font-bold text-white mb-3">
          Something went wrong
        </h2>

        {error?.message && (
          <p className="text-white/40 text-sm mb-3 font-mono bg-white/5 rounded-lg px-4 py-2 max-w-sm mx-auto truncate">
            {error.message}
          </p>
        )}

        <p className="text-white/50 text-base mb-10">
          An unexpected error occurred. Please try again.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-[#DC143C]/20"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="glass border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
