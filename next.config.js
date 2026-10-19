const isDev = process.env.NODE_ENV !== 'production'

// Sentry (optional). Browser events go straight to the DSN's ingest host, so it
// must be allowed in connect-src. Unset DSN = no CSP change and no wrapping.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || ''
let sentryOrigin = ''
try {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) sentryOrigin = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin
} catch {
  console.warn('[next.config] NEXT_PUBLIC_SENTRY_DSN is not a valid URL; browser error reporting will be blocked by the CSP')
}

// Pragmatic CSP: Next.js App Router emits inline bootstrap scripts, so
// script-src needs 'unsafe-inline' unless we move to per-request nonces.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://picsum.photos https://ui-avatars.com https://lh3.googleusercontent.com https://*.cjdropshipping.com https://cjdropshipping.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://api.cloudinary.com${sentryOrigin ? ` ${sentryOrigin}` : ''}${isDev ? ' ws: wss:' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  // PayFast checkout is a top-level form POST; it may redirect between its hosts.
  "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za https://*.payfast.co.za https://*.payfast.io",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'ui-avatars.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.cjdropshipping.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cjimg.fusionhalo.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

// Wrap with Sentry only when a DSN is configured, so builds without Sentry use
// exactly the same Next.js config as before. Source maps are uploaded (and then
// deleted from the public output) only when SENTRY_AUTH_TOKEN + SENTRY_ORG +
// SENTRY_PROJECT are set; otherwise the upload is skipped silently.
if (sentryDsn) {
  const { withSentryConfig } = require('@sentry/nextjs')
  const canUpload = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)
  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    telemetry: false,
    sourcemaps: { disable: !canUpload, deleteSourcemapsAfterUpload: true },
    release: { create: canUpload },
    widenClientFileUpload: true,
    disableLogger: true,
    // No /monitoring tunnel: it would run through middleware.ts; the CSP allows the DSN host instead.
    tunnelRoute: undefined,
  })
} else {
  module.exports = nextConfig
}
