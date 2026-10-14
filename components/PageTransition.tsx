'use client';

/**
 * Subtle fade-in for page content.
 *
 * - Server-rendered content is visible immediately (no opacity-0 flash before
 *   hydration, which hurt LCP).
 * - Opacity only: a CSS `transform` here would become the containing block for
 *   every `position: fixed` descendant (navbars, modals, bottom sheets) and
 *   make them scroll with the page.
 * - The keyframe is neutralised by the prefers-reduced-motion rule in globals.css.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div id="main-content" tabIndex={-1} className="animate-fadeIn outline-none" style={{ animationDuration: '0.25s' }}>
      {children}
    </div>
  );
}
