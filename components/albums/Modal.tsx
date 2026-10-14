'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider dialog for photo grids. */
  size?: 'md' | 'lg' | 'xl';
}

/**
 * Accessible dialog: bottom sheet on phones, centred card on larger screens.
 * Escape / backdrop closes; focus moves in on open, is trapped, and returns on close.
 */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Portal to <body> so page wrappers with transforms can't trap the dialog
  // under the fixed mobile nav.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])
        .filter((n) => !n.hasAttribute('disabled'));
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); }
      if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) return;
        const a = list[0], z = list[list.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;
  const width = size === 'xl' ? 'sm:max-w-4xl' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`relative w-full ${width} max-h-[92dvh] flex flex-col bg-[#13131B] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/60`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-white font-semibold text-lg leading-tight truncate">{title}</h2>
            {description && <p id={descId} className="text-white/60 text-sm mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-white/10 flex flex-wrap justify-end gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
