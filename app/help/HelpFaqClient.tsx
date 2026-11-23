'use client'

import { Fragment, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, X } from 'lucide-react'
import type { FaqSection } from './faq'

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g

/** Render `[label](/path)` as links; everything else as text. */
function renderAnswer(text: string): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    out.push(
      <Link key={i} href={m[2]} className="text-[#FF4D6D] underline">
        {m[1]}
      </Link>,
    )
    last = i + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.map((n, i) => <Fragment key={i}>{n}</Fragment>)
}

const plain = (text: string) => text.replace(LINK, '$1')
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'")

export default function HelpFaqClient({ sections }: { sections: FaqSection[] }) {
  const [query, setQuery] = useState('')
  const terms = norm(query).split(/\s+/).filter(Boolean)

  const filtered = !terms.length
    ? sections
    : sections
      .map((s) => ({
        ...s,
        items: s.items.filter((f) => {
          const hay = norm(`${s.title} ${f.q} ${plain(f.a)}`)
          return terms.every((t) => hay.includes(t))
        }),
      }))
      .filter((s) => s.items.length > 0)

  const total = filtered.reduce((n, s) => n + s.items.length, 0)
  const searching = terms.length > 0

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="help-search" className="sr-only">Search the Help Centre</label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. verify, cancel, block…"
            autoComplete="off"
            className="input-dark w-full pl-11 pr-11 py-3.5 rounded-2xl text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-white/60 text-xs mt-2" aria-live="polite">
          {searching ? `${total} ${total === 1 ? 'answer' : 'answers'} found` : ''}
        </p>
        {!searching && (
          <nav aria-label="Help topics" className="flex flex-wrap gap-2 mt-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-3 py-1.5 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/25 text-xs transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-white font-medium mb-1">No answers match “{query.trim()}”.</p>
          <p className="text-gray-400 text-sm">
            Try a different word, or <Link href="/help/contact" className="text-[#FF4D6D] underline">contact support</Link>.
          </p>
        </div>
      ) : (
        filtered.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
            <h2 id={`${s.id}-h`} className="text-2xl font-serif font-bold text-white mb-4">{s.title}</h2>
            <div className="space-y-2">
              {s.items.map((f) => (
                <details key={f.q} className="group glass rounded-2xl" open={searching}>
                  <summary className="flex items-center gap-3 p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="text-white font-semibold text-sm flex-1">{f.q}</span>
                    <ChevronRight size={16} className="text-white/60 flex-shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <p className="px-5 pb-5 -mt-1 text-gray-300 text-sm leading-relaxed">{renderAnswer(f.a)}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
