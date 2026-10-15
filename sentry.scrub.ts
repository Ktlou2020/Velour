// Shared privacy scrubbing for every Sentry runtime (server, edge, browser).
// Unbound is an adult dating site: events must never carry who a member is,
// what they typed, or anything that authenticates them. sendDefaultPii is off
// everywhere; this is the belt-and-braces pass over whatever is left.
import type { Breadcrumb, ErrorEvent, init } from '@sentry/nextjs'

type Options = NonNullable<Parameters<typeof init>[0]>
type TransactionEvent = Parameters<NonNullable<Options['beforeSendTransaction']>>[0]

const SENSITIVE_HEADERS = /^(authorization|cookie|set-cookie|proxy-authorization|x-forwarded-for|x-real-ip|cf-connecting-ip|true-client-ip|x-csrf-token|x-auth-token)$/i
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

/** Drops the query string and fragment (reset/verification tokens, search terms). */
export function stripQuery(url: string): string {
  const i = url.search(/[?#]/)
  return i === -1 ? url : url.slice(0, i)
}

function redactEmails(s: string): string {
  return s.replace(EMAIL, '[email]')
}

function scrubEvent<T extends ErrorEvent | TransactionEvent>(event: T): T {
  const req = event.request
  if (req) {
    delete req.cookies
    delete req.data // request bodies: messages, profile text, passwords
    delete req.query_string
    if (req.url) req.url = stripQuery(req.url)
    if (req.headers) {
      for (const k of Object.keys(req.headers)) if (SENSITIVE_HEADERS.test(k)) delete req.headers[k]
    }
  }
  // Keep only an opaque id if something set one; never email / username / IP.
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : {}
  if (event.message) event.message = redactEmails(event.message)
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactEmails(ex.value)
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((b: Breadcrumb) => scrubBreadcrumb(b)).filter((b): b is Breadcrumb => b !== null)
  return event
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  // Console output can contain anything (emails, message text); drop it.
  if (b.category === 'console') return null
  if (b.message) b.message = redactEmails(b.message)
  if (b.data) {
    for (const key of ['url', 'to', 'from']) {
      const v = b.data[key]
      if (typeof v === 'string') b.data[key] = stripQuery(v)
    }
  }
  return b
}

// Span attributes (OpenTelemetry) repeat the raw URL: http.target, url.full,
// url.query, next.span_name ("GET /?token=…"), db statements are fine.
const QUERY_KEYS = /^(url\.query|http\.query)$/
const URLISH_KEYS = /(^|\.)(target|url|full|path|span_name|route|name)$/

function scrubSpanData(data: Record<string, unknown> | undefined) {
  if (!data) return
  for (const [k, v] of Object.entries(data)) {
    if (QUERY_KEYS.test(k)) delete data[k]
    else if (typeof v === 'string' && URLISH_KEYS.test(k) && /[?#]/.test(v)) data[k] = stripQuery(v)
  }
}

function scrubSpans(event: ErrorEvent | TransactionEvent) {
  const trace = event.contexts?.trace as { data?: Record<string, unknown> } | undefined
  scrubSpanData(trace?.data)
  for (const span of (event as TransactionEvent).spans ?? []) {
    scrubSpanData(span.data as Record<string, unknown> | undefined)
    if (span.description && /[?#]/.test(span.description)) span.description = stripQuery(span.description)
  }
}

export const beforeSend = (event: ErrorEvent): ErrorEvent => {
  scrubEvent(event)
  scrubSpans(event)
  return event
}
export const beforeSendTransaction = (event: TransactionEvent): TransactionEvent => {
  scrubEvent(event)
  scrubSpans(event)
  if (event.transaction) event.transaction = stripQuery(event.transaction)
  return event
}

/** SENTRY_TRACES_SAMPLE_RATE / NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, default 0.1, clamped to [0, 1]. */
export function tracesSampleRate(raw: string | undefined): number {
  const n = raw === undefined || raw === '' ? 0.1 : Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.1
}

/** Options shared by every runtime. */
export function commonOptions(tracesRaw: string | undefined) {
  return {
    sendDefaultPii: false,
    tracesSampleRate: tracesSampleRate(tracesRaw),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    beforeSend,
    beforeSendTransaction,
    beforeBreadcrumb: scrubBreadcrumb,
  }
}
