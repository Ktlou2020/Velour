import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight, BadgeCheck, ChevronDown, EyeOff, Heart, ImageOff, Lock, MessageCircle, ShieldCheck, UserPlus, Users,
} from 'lucide-react'
import { DATING_PAGES, getDatingPage, linkText } from '../data'
import { DatingShell, JsonLd, cityMemberCount, siteJsonLd } from '../shared'
import { SITE_URL, SITE_NAME } from '../../site'

// Static at build time, refreshed hourly so the live member figure stays current.
export const revalidate = 3600
export const dynamicParams = false

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return DATING_PAGES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = getDatingPage(slug)
  if (!page) return {}
  const url = `/dating/${page.slug}`
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'en_ZA',
      url,
      siteName: SITE_NAME,
      title: `${page.title} · ${SITE_NAME}`,
      description: page.description,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} — private dating in South Africa` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${page.title} · ${SITE_NAME}`,
      description: page.description,
      images: ['/twitter-image'],
    },
  }
}

const HOW = [
  { icon: UserPlus, title: 'Create your profile', desc: 'Free, as a single or a couple. Add photos, a few prompts and what you’re looking for.' },
  { icon: Heart, title: 'Discover with intention', desc: 'Browse members near you or use Discover. Compatibility scores show why you might click.' },
  { icon: MessageCircle, title: 'Chat, then meet safely', desc: 'Talk privately, video-call, and use Share My Date to tell a friend where you’ll be.' },
]

const PRIVACY = [
  { icon: BadgeCheck, title: 'Photo verification', desc: 'A quick selfie check earns a verified badge — look for it before you say hello.' },
  { icon: Lock, title: 'Private albums', desc: 'Keep photos for members you choose, and revoke access whenever you like.' },
  { icon: EyeOff, title: 'Incognito browsing', desc: 'Platinum members can view profiles without appearing in “who viewed me”.' },
  { icon: ImageOff, title: 'Blurred chat photos', desc: 'Photos in chat stay blurred until you choose to reveal them.' },
  { icon: ShieldCheck, title: 'Screenshot protection', desc: 'Saving is blocked, media blurs when you switch apps, and every photo is watermarked with the viewer’s name.' },
]

export default async function DatingLandingPage({ params }: Props) {
  const { slug } = await params
  const page = getDatingPage(slug)
  if (!page) notFound()

  const count = await cityMemberCount(page.cityMatches)
  const related = page.related.map(getDatingPage).filter((p): p is NonNullable<typeof p> => !!p)
  const url = `${SITE_URL}/dating/${page.slug}`

  const jsonLd = [
    ...siteJsonLd(),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Dating in South Africa', item: `${SITE_URL}/dating` },
        { '@type': 'ListItem', position: 3, name: page.label, item: url },
      ],
    },
  ]

  return (
    <DatingShell>
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-14 pb-12 md:pt-20 md:pb-16">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(220,20,60,0.22),transparent_50%),radial-gradient(circle_at_85%_90%,rgba(212,175,55,0.10),transparent_45%)]" />
        <div className="relative max-w-3xl mx-auto text-center">
          <nav aria-label="Breadcrumb" className="text-xs text-white/50 mb-6">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/dating" className="hover:text-white">Dating</Link>
            <span className="mx-2">/</span>
            <span className="text-white/70">{page.label}</span>
          </nav>
          <p className="text-[#D4AF37] text-xs font-medium tracking-[0.2em] uppercase mb-4">{page.eyebrow}</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white mb-5 text-balance">{page.h1}</h1>
          <p className="text-white/75 text-base md:text-lg leading-relaxed mb-8">{page.lead}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth/signup" className="btn-crimson inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base">
              Join free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/safety" className="text-white/75 hover:text-white text-sm underline underline-offset-4">How we keep members safe</Link>
          </div>
          <p className="text-white/50 text-xs mt-5">Free to join · Strictly 18+ · Singles &amp; couples welcome</p>
          {count !== null && (
            <p className="mt-6 inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-white/80">
              <Users size={15} className="text-[#D4AF37]" aria-hidden="true" />
              {count.toLocaleString('en-ZA')} members list {page.label} as their city
            </p>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 pb-16 space-y-16">
        {/* Tailored sections */}
        <div className="grid gap-6 md:grid-cols-2">
          {page.sections.map((s) => (
            <section key={s.title} className="glass rounded-2xl p-6 md:p-8">
              <h2 className="font-serif text-2xl font-bold text-white mb-4">{s.title}</h2>
              <div className="space-y-3 text-white/75 leading-relaxed">
                {s.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          ))}
        </div>

        {/* How it works */}
        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-serif text-3xl font-bold text-white mb-8 text-center">How Unbound works</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {HOW.map((step, i) => (
              <li key={step.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-lg bg-[#DC143C]/15 text-[#DC143C] flex items-center justify-center" aria-hidden="true">
                    <step.icon size={18} />
                  </span>
                  <span className="text-[#D4AF37] text-xs font-semibold tracking-widest">0{i + 1}</span>
                </div>
                <h3 className="text-white font-semibold mb-1.5">{step.title}</h3>
                <p className="text-white/65 text-sm leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Privacy & safety */}
        <section aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="font-serif text-3xl font-bold text-white mb-3 text-center">Privacy &amp; safety, built in</h2>
          <p className="text-white/65 text-center max-w-xl mx-auto mb-8">
            Honest protections — no website can fully stop a screenshot, but we make misuse hard and traceable.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRIVACY.map((f) => (
              <li key={f.title} className="glass rounded-xl p-5 flex gap-3">
                <f.icon size={20} className="text-[#D4AF37] flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-white/65 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-center mt-6 text-sm">
            <Link href="/safety" className="text-[#FF4D6D] hover:text-white underline underline-offset-4">Visit the Safety Centre</Link>
            <span className="text-white/40 mx-2">·</span>
            <Link href="/pricing" className="text-[#FF4D6D] hover:text-white underline underline-offset-4">Compare memberships</Link>
          </p>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="max-w-3xl mx-auto">
          <h2 id="faq-heading" className="font-serif text-3xl font-bold text-white mb-6 text-center">Frequently asked questions</h2>
          <div className="space-y-3">
            {page.faqs.map((f) => (
              <details key={f.q} className="glass rounded-xl group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5 text-white font-medium">
                  {f.q}
                  <ChevronDown size={18} className="text-white/50 flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-5 -mt-1 text-white/70 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="glass rounded-2xl p-8 md:p-10 text-center border border-[#DC143C]/20">
          <h2 className="font-serif text-3xl font-bold text-white mb-3">Ready when you are</h2>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            Create your free profile in a few minutes. Share as much or as little as you like — you can always add more later.
          </p>
          <Link href="/auth/signup" className="btn-crimson inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base">
            Create my free profile <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <nav aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-white/90 font-semibold text-xs mb-4 uppercase tracking-[0.18em] text-center">Explore more</h2>
            <ul className="flex flex-wrap justify-center gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/dating/${r.slug}`} className="inline-block rounded-full border border-white/10 hover:border-[#DC143C]/50 px-4 py-2 text-sm text-white/75 hover:text-white transition-colors">
                    {linkText(r)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/dating" className="inline-block rounded-full border border-white/10 hover:border-[#DC143C]/50 px-4 py-2 text-sm text-white/75 hover:text-white transition-colors">All cities</Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </DatingShell>
  )
}
