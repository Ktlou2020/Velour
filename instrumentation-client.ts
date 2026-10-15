// Sentry for the browser. No-op unless NEXT_PUBLIC_SENTRY_DSN is set at build
// time (NEXT_PUBLIC_* values are inlined by next build, so without it the
// branch below is dead code and the SDK is not bundled at all). No session replay.
type SentryModule = typeof import('@sentry/nextjs')

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
let sentry: SentryModule | null = null

if (dsn) {
  Promise.all([import('@sentry/nextjs'), import('./sentry.scrub')])
    .then(([Sentry, { commonOptions }]) => {
      Sentry.init({
        dsn,
        ...commonOptions(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      })
      sentry = Sentry
    })
    .catch(() => {})
}

// Traces client-side navigations once Sentry has loaded.
export function onRouterTransitionStart(...args: Parameters<SentryModule['captureRouterTransitionStart']>) {
  sentry?.captureRouterTransitionStart(...args)
}
