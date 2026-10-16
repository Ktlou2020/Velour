import Link from 'next/link'
import type { ReactNode } from 'react'
import { LogoMark } from '@/components/Logo'
import Footer from '@/components/Footer'
import { db } from '@/lib/db'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../site'

/** Only show a live member figure once it's meaningful (and never a made-up one). */
export const MIN_PUBLIC_COUNT = 20

/** Active members whose Profile.city matches any of `names` (case-insensitive); null if < 20 or on error. */
export async function cityMemberCount(names: string[] | undefined): Promise<number | null> {
  if (!names?.length) return null
  try {
    const n = await db.profile.count({
      where: { city: { in: names, mode: 'insensitive' }, user: { isActive: true } },
    })
    return n >= MIN_PUBLIC_COUNT ? n : null
  } catch {
    return null
  }
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped can't break out of the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

export function siteJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      description: SITE_DESCRIPTION,
      areaServed: { '@type': 'Country', name: 'South Africa' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'en-ZA',
    },
  ]
}

export function DatingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <header className="border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-10">
        <nav aria-label="Main" className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label="Unbound home">
            <LogoMark size="sm" />
            <span className="font-serif font-bold tracking-wide text-white">UNBOUND</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-4 text-sm">
            <Link href="/dating" className="hidden sm:inline text-white/70 hover:text-white transition-colors">Cities</Link>
            <Link href="/pricing" className="hidden sm:inline text-white/70 hover:text-white transition-colors">Pricing</Link>
            <Link href="/auth/signin" className="text-white/80 hover:text-white px-3 py-2 transition-colors">Sign in</Link>
            <Link href="/auth/signup" className="btn-crimson px-4 py-2 rounded-xl font-semibold">Join free</Link>
          </div>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  )
}
