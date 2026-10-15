import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import Footer from '@/components/Footer'
import { BUSINESS, addressLines } from '@/lib/business'

/** Shared shell for the public policy pages — same look as /terms and /privacy. */
export function LegalShell({ eyebrow = 'Legal', title, lastUpdated, children }: { eyebrow?: string; title: string; lastUpdated?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Hush</span>
          </Link>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="font-serif font-bold tracking-wide text-white">HUSH</span>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-[#DC143C]/50 to-transparent" />
            <span className="text-[#D4AF37] text-xs font-medium tracking-widest uppercase">{eyebrow}</span>
            <div className="h-px flex-1 bg-gradient-to-l from-[#DC143C]/50 to-transparent" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-white mt-4 mb-3">{title}</h1>
          {lastUpdated && <p className="text-gray-400 text-sm">Last updated: {lastUpdated}</p>}
        </div>

        <div className="space-y-8">{children}</div>
      </main>

      <Footer />
    </div>
  )
}

export function Intro({ children }: { children: ReactNode }) {
  return <div className="glass rounded-2xl p-6 space-y-3 text-gray-300 leading-relaxed">{children}</div>
}

export function Section({ n, title, id, children }: { n?: number | string; title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className={id ? 'scroll-mt-24' : undefined}>
      <h2 className="text-2xl font-serif font-bold text-white mb-4 flex items-center gap-3">
        {n !== undefined && (
          <span className="w-8 h-8 rounded-lg bg-[#DC143C]/15 flex items-center justify-center text-[#DC143C] text-sm font-bold flex-shrink-0">{n}</span>
        )}
        {title}
      </h2>
      <div className={`space-y-3 text-gray-300 leading-relaxed ${n !== undefined ? 'sm:pl-11' : ''}`}>{children}</div>
    </section>
  )
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-white">{children}</strong>
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const cls = 'text-[#DC143C] hover:underline'
  if (href.startsWith('/')) return <Link href={href} className={cls}>{children}</Link>
  return <a href={href} className={cls}>{children}</a>
}

export function Mail({ email = BUSINESS.email, subject }: { email?: string; subject?: string }) {
  const href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
  return <a href={href} className="text-[#DC143C] hover:underline">{email}</a>
}

/** Business details block — renders only the fields that are configured. */
export function BusinessDetails({ heading = 'Contact us', blurb, showInfoOfficer = false }: { heading?: string; blurb?: ReactNode; showInfoOfficer?: boolean }) {
  const lines = addressLines()
  const rows: { label: string; value: ReactNode }[] = []
  if (BUSINESS.legalName) rows.push({ label: 'Company', value: BUSINESS.legalName })
  rows.push({ label: 'Trading as', value: BUSINESS.tradingName })
  if (BUSINESS.registrationNumber) rows.push({ label: 'Registration number', value: BUSINESS.registrationNumber })
  if (BUSINESS.vatNumber) rows.push({ label: 'VAT number', value: BUSINESS.vatNumber })
  if (showInfoOfficer && BUSINESS.informationOfficer) rows.push({ label: 'Information Officer', value: BUSINESS.informationOfficer })
  rows.push({ label: 'Email', value: <Mail /> })
  if (BUSINESS.phone) {
    rows.push({ label: 'Phone', value: <a href={`tel:${BUSINESS.phone.replace(/[^\d+]/g, '')}`} className="text-[#DC143C] hover:underline">{BUSINESS.phone}</a> })
  }
  if (lines.length) {
    rows.push({ label: 'Address', value: <span className="inline-block align-top">{lines.map((l, i) => <span key={i} className="block">{l}</span>)}</span> })
  }
  rows.push({ label: 'Country', value: 'South Africa' })

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-xl font-serif font-bold text-white mb-4">{heading}</h2>
      {blurb && <div className="text-gray-300 leading-relaxed mb-4">{blurb}</div>}
      <dl className="space-y-2 text-gray-300 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap gap-x-2">
            <dt className="text-gray-400">{r.label}:</dt>
            <dd className="text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
