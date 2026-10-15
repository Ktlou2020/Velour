// Sentry for the edge runtime (edge routes; middleware runs on Node.js here).
// No-op unless SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'
import { commonOptions } from './sentry.scrub'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    ...commonOptions(process.env.SENTRY_TRACES_SAMPLE_RATE),
    release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
  })
}
