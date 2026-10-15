// Sentry for the Node.js server runtime (loaded from instrumentation.ts).
// No-op unless SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'
import { commonOptions } from './sentry.scrub'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    ...commonOptions(process.env.SENTRY_TRACES_SAMPLE_RATE),
    release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
    // Never attach local variable values to stack frames (they can hold member data).
    includeLocalVariables: false,
  })
}
