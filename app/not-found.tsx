import Link from 'next/link';
import { LogoMark } from '@/components/Logo'

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background blur circles */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 animate-pulse"
        style={{ background: 'radial-gradient(circle, #DC143C 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15 animate-pulse"
        style={{ background: 'radial-gradient(circle, #8F0D25 0%, transparent 70%)', animationDelay: '1s' }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #DC143C 0%, transparent 60%)' }}
      />

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-12" aria-label="Hush home">
          <LogoMark size="md" />
          <span className="text-white font-bold text-2xl tracking-widest font-serif">HUSH</span>
        </Link>

        {/* 404 */}
        <p
          aria-hidden="true"
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
          404
        </p>

        <h1 className="font-serif text-2xl md:text-3xl font-bold text-white mb-3">
          This page slipped away
        </h1>
        <p className="text-white/65 text-base mb-10">
          The link may be old, or the page may have moved. Let&apos;s get you somewhere better.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/members"
            className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-[#DC143C]/20"
          >
            Browse members
          </Link>
          <Link
            href="/"
            className="glass border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
