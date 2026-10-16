import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import { DATING_PAGES, linkText } from './data'
import { DatingShell, JsonLd, siteJsonLd } from './shared'
import { SITE_URL, SITE_NAME } from '../site'

const TITLE = 'Dating in South Africa — Cities, Couples & Communities'
const DESCRIPTION =
  'Find private, verified dating near you on Unbound: Johannesburg, Cape Town, Durban, Pretoria and more, plus couples, LGBTQ+ and discreet dating across South Africa. 18+.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/dating' },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: '/dating',
    siteName: SITE_NAME,
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} — private dating in South Africa` }],
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} · ${SITE_NAME}`, description: DESCRIPTION, images: ['/twitter-image'] },
}

const GROUPS = [
  { heading: 'Dating by city', kind: 'city' as const },
  { heading: 'Couples dating by city', kind: 'couples-city' as const },
  { heading: 'Communities', kind: 'audience' as const },
]

export default function DatingIndexPage() {
  const jsonLd = [
    ...siteJsonLd(),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Dating in South Africa',
      itemListElement: DATING_PAGES.map((p, i) => ({
        '@type': 'ListItem', position: i + 1, name: linkText(p), url: `${SITE_URL}/dating/${p.slug}`,
      })),
    },
  ]

  return (
    <DatingShell>
      <JsonLd data={jsonLd} />
      <section className="px-4 pt-14 pb-10 text-center max-w-3xl mx-auto">
        <p className="text-[#D4AF37] text-xs font-medium tracking-[0.2em] uppercase mb-4">South Africa</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white mb-5 text-balance">Private, verified dating across South Africa</h1>
        <p className="text-white/75 text-base md:text-lg leading-relaxed">
          Unbound is open to adults everywhere in South Africa, with distance-based search so you always see people near you.
          Pick your city or community to see what dating on Unbound looks like there.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-4 pb-16 space-y-12">
        {GROUPS.map((g) => {
          const pages = DATING_PAGES.filter((p) => p.kind === g.kind)
          return (
            <section key={g.kind} aria-labelledby={`h-${g.kind}`}>
              <h2 id={`h-${g.kind}`} className="font-serif text-2xl font-bold text-white mb-5">{g.heading}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/dating/${p.slug}`} className="glass rounded-xl p-4 flex items-start gap-3 hover:border-[#DC143C]/40 border border-transparent transition-colors h-full">
                      <MapPin size={18} className="text-[#DC143C] flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <span className="block text-white font-medium">{linkText(p)}</span>
                        <span className="block text-white/55 text-xs mt-0.5">{p.eyebrow}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        <section className="glass rounded-2xl p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-white mb-3">Don’t see your town?</h2>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            You don’t need a city page to join. Set your location and search distance and you’ll see members near you, wherever you are.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="btn-crimson inline-flex items-center gap-2 px-7 py-3.5 rounded-xl">
              Join free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="text-white/75 hover:text-white text-sm underline underline-offset-4">See pricing</Link>
            <Link href="/safety" className="text-white/75 hover:text-white text-sm underline underline-offset-4">Safety Centre</Link>
          </div>
        </section>
      </div>
    </DatingShell>
  )
}
