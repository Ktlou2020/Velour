'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/lib/toast-context';

const SHIELD = 'hush-shield';
const FLASH = 'hush-shield-flash';
const FLASH_MS = 1500;

/**
 * Global privacy shield for members' media (everything marked `data-protected`).
 *
 * - Blurs protected media while the tab is hidden or the window loses focus,
 *   so app-switcher previews and most screen-capture overlays (which take
 *   focus) don't show photos. Focus changes inside the page never trigger it:
 *   only window `blur` while `document.hasFocus()` is false.
 * - On screenshot shortcuts (PrintScreen, ⌘⇧3/4/5, Win+Shift+S) blurs for
 *   ~1.5 s and shows a reminder. It can't stop an OS screenshot — no website
 *   can — but PrintScreen-key captures often get the blurred state.
 * - Printing hides protected media entirely (CSS in globals.css) and prints
 *   a short notice instead.
 */
export default function PrivacyShield() {
  const { showToast } = useToast();
  const toastAt = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = document.documentElement;

    const shield = (on: boolean) => root.classList.toggle(SHIELD, on);
    const update = () => {
      if (document.visibilityState === 'hidden') shield(true);
    };

    function flash() {
      root.classList.add(FLASH);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => root.classList.remove(FLASH), FLASH_MS);
      const now = Date.now();
      if (now - toastAt.current > 4000) {
        toastAt.current = now;
        showToast('Screenshots of members’ content aren’t allowed on Unbound', 'info');
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') shield(true);
      else if (document.hasFocus()) shield(false);
    }
    function onBlur() {
      // Focus moving between elements of the page doesn't fire window blur;
      // still double-check after the event loop settles.
      setTimeout(() => { if (!document.hasFocus()) shield(true); }, 0);
    }
    function onFocus() {
      if (document.visibilityState === 'visible') shield(false);
    }
    // Any interaction proves the page is in front again (some browsers skip `focus`).
    function onInteract() {
      if (root.classList.contains(SHIELD) && document.visibilityState === 'visible') shield(false);
    }

    function onPageHide() {
      shield(true);
    }

    function isShotCombo(e: KeyboardEvent) {
      const k = e.key?.toLowerCase();
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') return true;
      // macOS: ⌘⇧3 / ⌘⇧4 / ⌘⇧5 (and with ⌃ to copy)
      if (e.metaKey && e.shiftKey && (['3', '4', '5'].includes(k) || ['Digit3', 'Digit4', 'Digit5'].includes(e.code))) return true;
      // Windows Snipping Tool: Win+Shift+S
      if (e.metaKey && e.shiftKey && (k === 's' || e.code === 'KeyS')) return true;
      return false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isShotCombo(e)) flash();
    }
    function onKeyUp(e: KeyboardEvent) {
      // Windows delivers PrintScreen on keyup only, after the capture is in the clipboard.
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        flash();
        try { navigator.clipboard?.writeText('Screenshots of members’ content aren’t allowed on Unbound.').catch(() => {}); } catch { /* not allowed */ }
      }
    }

    update();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pointerdown', onInteract, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pointerdown', onInteract, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onVisibility);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      root.classList.remove(SHIELD, FLASH);
    };
  }, [showToast]);

  return (
    <div className="hush-print-notice" aria-hidden="true">
      Members’ photos and videos are hidden when printing. Screenshots, recordings and sharing of members’ content are not allowed on Unbound.
    </div>
  );
}
