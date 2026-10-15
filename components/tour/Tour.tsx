'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { buildSteps } from './steps';

type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top: number; left: number };

const PAD = 6; // breathing room around the spotlighted element
const GAP = 12; // distance between spotlight and card
const MARGIN = 12; // minimum distance from the viewport edge

/** First element carrying one of the `data-tour` values that's actually visible. */
function findTarget(targets: string[] | undefined): HTMLElement | null {
  if (!targets) return null;
  for (const t of targets) {
    const els = document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue; // display:none (or inside a hidden bar)
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
      return el;
    }
  }
  return null;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)));

export default function Tour({ onClose }: { onClose: (reason: 'finished' | 'skipped') => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const close = useCallback((reason: 'finished' | 'skipped') => onClose(reason), [onClose]);
  const steps = useMemo(() => buildSteps(() => close('finished')), [close]);
  const step = steps[index];
  const last = index === steps.length - 1;

  const next = useCallback(() => {
    if (last) close('finished');
    else setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [last, close, steps.length]);
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // ── Measure the target ──────────────────────────────────────────────
  const measure = useCallback(() => {
    const el = findTarget(step.targets);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    // Keep the cut-out inside the viewport so it never causes overflow.
    const left = Math.max(2, r.left - PAD);
    const top = Math.max(2, r.top - PAD);
    const right = Math.min(vw - 2, r.right + PAD);
    const bottom = Math.min(vh - 2, r.bottom + PAD);
    setRect({ top, left, width: right - left, height: bottom - top });
  }, [step]);

  useLayoutEffect(() => {
    measure();
    // Targets can render a beat late (session/bars hydrating) — re-check.
    const t1 = window.setTimeout(measure, 150);
    const t2 = window.setTimeout(measure, 500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [measure]);

  useEffect(() => {
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [measure]);

  // ── Position the card next to the target, inside the viewport ───────
  const place = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = card.offsetWidth;
    const h = card.offsetHeight;

    // Stay above the mobile bottom tab bar unless the target is in it (then we sit above it anyway).
    let floor = vh - MARGIN;
    // Only a bar docked in the lower half is the mobile tab bar (the desktop header shares the label).
    for (const bar of Array.from(document.querySelectorAll<HTMLElement>('nav[aria-label="Primary"]'))) {
      const br = bar.getBoundingClientRect();
      if (br.height > 0 && br.top < vh && br.top > vh / 2) floor = Math.min(floor, br.top - MARGIN);
    }
    const ceil = MARGIN;

    let top: number;
    let left: number;
    if (!rect) {
      top = (ceil + floor - h) / 2;
      left = (vw - w) / 2;
    } else {
      const below = rect.top + rect.height + GAP;
      const above = rect.top - GAP - h;
      if (below + h <= floor) top = below;
      else if (above >= ceil) top = above;
      else top = (ceil + floor - h) / 2;
      left = rect.left + rect.width / 2 - w / 2;
    }
    setPos({
      top: clamp(top, ceil, floor - h),
      left: clamp(left, MARGIN, vw - w - MARGIN),
    });
  }, [rect]);

  useLayoutEffect(() => { place(); }, [place, index]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => place());
    ro.observe(card);
    window.addEventListener('resize', place);
    return () => { ro.disconnect(); window.removeEventListener('resize', place); };
  }, [place]);

  // ── Focus management ────────────────────────────────────────────────
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      const el = restoreFocusRef.current;
      if (el && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    // If the focused button vanished (e.g. Back on step 1), keep focus inside.
    const card = cardRef.current;
    if (card && !card.contains(document.activeElement)) card.focus({ preventScroll: true });
  }, [index]);

  // ── Keyboard: Esc skips, arrows move, Tab stays inside ──────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); close('skipped'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); return; }
      if (e.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        const items = Array.from(card.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0];
        const lastEl = items[items.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (active === first || active === card)) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && active === lastEl) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, next, back]);

  const Icon = step.icon;
  const moveCls = 'motion-safe:transition-[top,left,width,height,opacity] motion-safe:duration-300 motion-safe:ease-out';

  return (
    <div className="fixed inset-0 z-[9500] overflow-hidden" data-tour-root="">
      {/* Click shield: the page underneath isn't interactive while touring. */}
      <div className="absolute inset-0" aria-hidden="true" onClick={(e) => e.stopPropagation()} />

      {/* Backdrop with a cut-out around the target (or a plain dim when centred). */}
      {rect ? (
        <div
          aria-hidden="true"
          className={`absolute rounded-xl pointer-events-none ring-2 ring-[#DC143C]/80 ${moveCls}`}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 200vmax rgba(5,5,10,0.74), 0 0 24px 4px rgba(220,20,60,0.35)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(5,5,10,0.74)] pointer-events-none" />
      )}

      {/* Announce step changes to screen readers. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`Step ${index + 1} of ${steps.length}: ${step.title}`}
      </p>

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={`absolute w-[min(22rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#121218]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70 ${moveCls}`}
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, opacity: pos ? 1 : 0 }}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC143C]/25 to-[#D4AF37]/15 border border-white/10 flex items-center justify-center">
            <Icon size={20} className="text-[#D4AF37]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/45 font-semibold">
              Step {index + 1} of {steps.length}
            </p>
            <h2 id={titleId} className="font-serif text-lg font-semibold text-white leading-snug">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => close('skipped')}
            className="shrink-0 -mr-1 -mt-1 w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close tour"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div id={bodyId} className="mt-3 text-sm leading-relaxed text-white/75">
          {step.body}
        </div>

        {/* Progress dots */}
        <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                i === index ? 'w-5 bg-[#DC143C]' : i < index ? 'w-1.5 bg-[#DC143C]/50' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button
              type="button"
              onClick={() => close('skipped')}
              className="px-2 py-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              Skip
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-white/80 border border-white/15 hover:border-white/30 hover:text-white transition-colors"
              >
                <ArrowLeft size={14} aria-hidden="true" />Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] transition-colors"
            >
              {last ? 'Get started' : index === 0 ? 'Show me' : 'Next'}
              {!last && <ArrowRight size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
