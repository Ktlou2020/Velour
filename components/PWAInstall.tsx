'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { LogoMark } from '@/components/Logo'
import { Download, X, Bell, Share, PlusSquare } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

/**
 * Install + push prompts for signed-in members.
 *
 * When the install sheet appears:
 *  - signed in, not already running as an installed app;
 *  - this is at least their 2nd visit (a visit = a browser session, counted in
 *    localStorage) OR they have opened a conversation (first match/message);
 *    other code can also fire `window.dispatchEvent(new Event('unbound:engaged'))`;
 *  - never on the first page view of a visit: only after a later in-app
 *    navigation, plus a short settle delay;
 *  - not on focused screens (chat composer, swipe deck, forms);
 *  - "Not now" hides it for 30 days; installing hides it for good.
 * Android/desktop Chromium use `beforeinstallprompt`; iOS has no such event,
 * so iPhone/iPad users get "Share → Add to Home Screen" instructions.
 */

const DISMISS_DAYS = 30;
const SETTLE_MS = 3000;
const KEY_VISITS = 'unbound_pwa_visits';
const KEY_SESSION = 'unbound_pwa_session';
const KEY_ENGAGED = 'unbound_pwa_engaged';
const KEY_INSTALL_DISMISSED = 'unbound_pwa_dismissed_at';
const KEY_PUSH_DISMISSED = 'unbound_push_dismissed_at';
const KEY_INSTALLED = 'unbound_pwa_installed';
const LEGACY_DISMISSED = 'velour_pwa_dismissed';
/** Screens where a floating sheet would cover the composer / swipe buttons / form actions. */
const QUIET_PATHS = ['/messages', '/discover', '/onboarding', '/auth', '/upgrade', '/subscription', '/admin'];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function store(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
function getItem(k: string): string | null {
  try { return store()?.getItem(k) ?? null; } catch { return null; }
}
function setItem(k: string, v: string) {
  try { store()?.setItem(k, v); } catch { /* private mode */ }
}
function dismissedRecently(key: string): boolean {
  const at = Number(getItem(key) || 0);
  return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const SHEET =
  'fixed z-40 left-3 right-3 md:left-auto md:right-4 md:w-96 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 ' +
  'glass border border-white/15 rounded-2xl p-4 shadow-2xl shadow-black/50';

export default function PWAInstall() {
  const { status } = useSession();
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [pushDismissed, setPushDismissed] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [ios, setIos] = useState(false);
  const [ready, setReady] = useState(false);
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'none'>('none');
  const [pushBusy, setPushBusy] = useState(false);
  // Server push config: null = unknown yet. Push is only offered when the
  // server has VAPID keys (GET /api/push → { enabled, publicKey }).
  const [pushKey, setPushKey] = useState<string | null>(null);
  const firstPath = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/push', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean; publicKey?: string } | null) => {
        if (!cancelled) setPushKey(d?.enabled && d.publicKey ? d.publicKey : '');
      })
      .catch(() => { if (!cancelled) setPushKey(''); });
    return () => { cancelled = true; };
  }, [status]);

  const doSubscribe = useCallback(async (publicKey: string) => {
    if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushStatus('granted');
      if (res.ok) setItem('velour_push_ok', '1');
    } catch { /* denied or error */ }
    finally { setPushBusy(false); }
  }, []);

  // Already allowed in this browser but not saved yet → subscribe quietly
  useEffect(() => {
    if (!pushKey || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' && !getItem('velour_push_ok')) doSubscribe(pushKey);
  }, [pushKey, doSubscribe]);

  // Setup for signed-in members: SW, visit count, install event listeners.
  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
    if ('Notification' in window) {
      setPushStatus(Notification.permission as 'default' | 'granted' | 'denied');
    }

    // The old prompt's "dismiss" was permanent; restart it as a 30-day snooze.
    if (getItem(LEGACY_DISMISSED)) {
      setItem(KEY_INSTALL_DISMISSED, String(Date.now()));
      setItem(KEY_PUSH_DISMISSED, String(Date.now()));
      try { store()?.removeItem(LEGACY_DISMISSED); } catch { /* ignore */ }
    }

    // One visit per browser session.
    let visits = Number(getItem(KEY_VISITS) || 0);
    let newSession = false;
    try { newSession = !sessionStorage.getItem(KEY_SESSION); sessionStorage.setItem(KEY_SESSION, '1'); } catch { /* ignore */ }
    if (newSession) { visits += 1; setItem(KEY_VISITS, String(visits)); }

    setIos(isIOS());
    setInstallDismissed(!!getItem(KEY_INSTALLED) || dismissedRecently(KEY_INSTALL_DISMISSED));
    setPushDismissed(dismissedRecently(KEY_PUSH_DISMISSED));
    setEligible(!isStandalone() && (visits >= 2 || !!getItem(KEY_ENGAGED)));

    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setItem(KEY_INSTALLED, '1'); setPrompt(null); setInstallDismissed(true); };
    const onEngaged = () => { setItem(KEY_ENGAGED, '1'); if (!isStandalone()) setEligible(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('unbound:engaged', onEngaged);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('unbound:engaged', onEngaged);
    };
  }, [status]);

  // Opening a conversation counts as a first match/message.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (/^\/messages\/[^/]+/.test(pathname)) {
      setItem(KEY_ENGAGED, '1');
      if (!isStandalone()) setEligible(true);
    }
  }, [pathname, status]);

  // Never on the first page view of a visit: wait for a later navigation, then settle.
  useEffect(() => {
    if (firstPath.current === null) { firstPath.current = pathname; return; }
    if (ready || pathname === firstPath.current) return;
    const t = setTimeout(() => setReady(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [pathname, ready]);

  const dismissInstall = useCallback(() => {
    setItem(KEY_INSTALL_DISMISSED, String(Date.now()));
    setInstallDismissed(true);
    setPrompt(null);
  }, []);

  const dismissPush = useCallback(() => {
    setItem(KEY_PUSH_DISMISSED, String(Date.now()));
    setPushDismissed(true);
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'accepted') setItem(KEY_INSTALLED, '1');
    else dismissInstall();
  }

  async function enablePush() {
    if (!pushKey) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') await doSubscribe(pushKey);
    else setPushStatus('denied');
  }

  const quiet = QUIET_PATHS.some((p) => pathname.startsWith(p));
  const visible = status === 'authenticated' && ready && !quiet;
  const showInstall = visible && eligible && !installDismissed && !isStandalone() && (!!prompt || ios);
  const showPush =
    visible && !showInstall && !pushDismissed && !!pushKey && pushStatus === 'default' &&
    typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window;

  // Escape closes whichever sheet is open (it never takes focus, so this is the keyboard route out).
  useEffect(() => {
    if (!showInstall && !showPush) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showInstall) dismissInstall(); else dismissPush();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showInstall, showPush, dismissInstall, dismissPush]);

  if (showInstall) {
    return (
      <section role="dialog" aria-modal="false" aria-labelledby="pwa-install-title" aria-describedby="pwa-install-desc" className={SHEET}>
        <div className="flex items-start gap-3">
          <LogoMark size="sm" />
          <div className="flex-1 min-w-0">
            <h2 id="pwa-install-title" className="text-white text-sm font-semibold">Add Unbound to your home screen</h2>
            <p id="pwa-install-desc" className="text-white/65 text-xs mt-0.5 leading-relaxed">
              Open it like an app, full-screen and one tap away — no app store needed.
            </p>
          </div>
          <button onClick={dismissInstall} className="-mr-1 -mt-1 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors" aria-label="Not now — hide for 30 days">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {prompt ? (
          <div className="flex items-center justify-end gap-2 mt-3">
            <button onClick={dismissInstall} className="text-white/70 hover:text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
              Not now
            </button>
            <button onClick={install} className="btn-crimson flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg">
              <Download size={13} aria-hidden="true" />Install
            </button>
          </div>
        ) : (
          <ol className="mt-3 space-y-2 text-xs text-white/70">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-bold" aria-hidden="true">1</span>
              <span>Tap <Share size={12} className="inline -mt-0.5" aria-hidden="true" /> <strong className="text-white/85">Share</strong> in the browser toolbar</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-bold" aria-hidden="true">2</span>
              <span>Choose <PlusSquare size={12} className="inline -mt-0.5" aria-hidden="true" /> <strong className="text-white/85">Add to Home Screen</strong></span>
            </li>
          </ol>
        )}
      </section>
    );
  }

  if (showPush) {
    return (
      <section role="dialog" aria-modal="false" aria-labelledby="pwa-push-title" className={`${SHEET} flex items-center gap-3 border-[#DC143C]/20`}>
        <div className="w-9 h-9 rounded-lg bg-[#DC143C]/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Bell size={16} className="text-[#DC143C]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="pwa-push-title" className="text-white text-sm font-medium">Enable notifications</h2>
          <p className="text-white/65 text-xs">Get alerts for matches &amp; messages</p>
        </div>
        <button onClick={enablePush} disabled={pushBusy} className="flex items-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-70">
          {pushBusy
            ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            : <Bell size={12} aria-hidden="true" />}
          Enable
        </button>
        <button onClick={dismissPush} className="text-white/60 hover:text-white transition-colors flex-shrink-0" aria-label="Not now — hide for 30 days">
          <X size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  return null;
}
