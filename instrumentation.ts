// Next.js instrumentation hook: loads the Sentry config for the active runtime.
// Without SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) nothing is loaded at all.
type SentryModule = typeof import('@sentry/nextjs')

const enabled = () => Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)

export async function register() {
  if (!enabled()) return
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Reports errors thrown in server components, route handlers, server actions
// and middleware.
export async function onRequestError(...args: Parameters<SentryModule['captureRequestError']>) {
  if (!enabled()) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
