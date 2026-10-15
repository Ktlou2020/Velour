'use client';

import { useSession } from 'next-auth/react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  /**
   * Show the on-screen viewer watermark. Any non-empty value turns it on and
   * renders "@<your username> · hush" (an email is never shown on screen);
   * "" or undefined leaves it off. The server burns its own per-viewer mark
   * into the image file regardless.
   */
  watermark?: string;
  style?: React.CSSProperties;
  /** Defaults to lazy; pass "eager" for above-the-fold hero images. */
  loading?: 'lazy' | 'eager';
  /** Extra classes for the <img> (default: object-cover filling the box). */
  imgClassName?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
}

function block(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

/** Styles that stop drag, selection and the iOS long-press "Save image" sheet. */
export const NO_SAVE_STYLE = {
  WebkitUserDrag: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
  WebkitTouchCallout: 'none',
} as React.CSSProperties;

/**
 * Text for the on-screen watermark: the viewer's @username. Falls back to the
 * given text unless it looks like an email address (never shown on screen).
 */
export function useViewerMark(requested?: string | boolean): string | null {
  const { data } = useSession();
  if (!requested) return null;
  const username = (data?.user as { username?: string } | undefined)?.username;
  if (username) return `@${username} · hush`;
  if (typeof requested === 'string' && !requested.includes('@')) return requested;
  return 'unbound';
}

/**
 * Tiled, rotated text as a CSS background (an SVG data URI, so it costs one
 * layer instead of dozens of DOM nodes). Very faint: the file itself carries
 * the forensic mark; this one shows on screen recordings of any media.
 */
export function watermarkBackground(text: string, opacity = 0.09): React.CSSProperties {
  const safe = text.replace(/[^A-Za-z0-9_.@ ·-]/g, '').slice(0, 48);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='150'>` +
    `<text x='120' y='80' text-anchor='middle' transform='rotate(-30 120 75)' font-family='Inter,system-ui,sans-serif' font-size='12' font-weight='600' letter-spacing='1' fill='white' fill-opacity='${opacity}' stroke='black' stroke-opacity='${(opacity * 0.6).toFixed(3)}' stroke-width='0.5'>${safe}</text>` +
    `</svg>`;
  return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, backgroundRepeat: 'repeat' };
}

/**
 * A member's photo with save protections:
 * - right-click, drag, text selection and the iOS long-press menu blocked
 *   (a transparent layer sits over the <img>, so a long-press never targets it)
 * - page scrolling and pinch-zoom still work on touch screens
 * - `data-protected`: blurred by PrivacyShield in the app switcher / during
 *   screenshot shortcuts, hidden when printing
 * - optional on-screen viewer watermark
 */
export default function ProtectedImage({ src, alt, className, watermark, style, loading = 'lazy', imgClassName, onLoad }: Props) {
  const mark = useViewerMark(watermark);

  return (
    <div
      data-protected=""
      className={`relative overflow-hidden select-none ${className ?? ''}`}
      style={{ ...NO_SAVE_STYLE, ...style }}
      onContextMenu={block}
      onDragStart={block}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={imgClassName ?? 'w-full h-full object-cover pointer-events-none'}
        style={NO_SAVE_STYLE}
        draggable={false}
        onContextMenu={block}
        onDragStart={block}
        onLoad={onLoad}
      />

      {/* Transparent layer: receives every touch/click instead of the <img>. */}
      <div
        className="absolute inset-0"
        style={{ touchAction: 'manipulation', ...NO_SAVE_STYLE }}
        onContextMenu={block}
        onDragStart={block}
        aria-hidden="true"
      />

      {mark && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={watermarkBackground(mark)} />
      )}
    </div>
  );
}
