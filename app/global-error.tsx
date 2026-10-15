'use client';

// Last-resort error boundary: only renders when the root layout itself fails
// (app/error.tsx handles everything below it). It replaces the whole document,
// so it brings its own <html>/<body> and inline styles (globals.css may not load).
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Loaded lazily and only when NEXT_PUBLIC_SENTRY_DSN was set at build time,
    // so the SDK is not bundled at all without it.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => {});
    }
    console.error('Root layout error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0A0A0F',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          textAlign: 'center',
        }}
      >
        <main style={{ maxWidth: 480 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 28, letterSpacing: '0.2em', margin: '0 0 32px' }}>
            UNBOUND
          </p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 12px' }}>Something went wrong</h1>
          {error?.digest && (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'monospace', margin: '0 0 12px' }}>
              Reference: {error.digest}
            </p>
          )}
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, margin: '0 0 32px' }}>
            We hit a snag on our side. Your account and messages are safe — please try again.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{
                background: 'linear-gradient(90deg, #DC143C, #8F0D25)',
                color: '#ffffff',
                border: 0,
                borderRadius: 12,
                padding: '12px 32px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {/* Full reload on purpose: the client router may be what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.7)',
                borderRadius: 12,
                padding: '12px 32px',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
