'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { LogoMark } from '@/components/Logo'
import Link from 'next/link';
import { X, Bell, Check } from 'lucide-react';
import InstallSteps from '@/components/app/InstallSteps';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import {
  INSTALL_AVAILABLE_EVENT, INSTALL_MOMENT_EVENT, enablePush as enableDevicePush, getPushKey, installMethod, isMobileDevice,
  isStandalone, registerServiceWorker, reportAppUse, type InstallMethod, type InstallMoment,
} from '@/lib/pwa-client';

/**
 * Install + push prompts for signed-in members.
 *
 * The install sheet ("Get the Unbound app") shows on phones that aren't
 * running Unbound from the home screen yet:
 *  - from the first visit, after the member moves to a second page and a
 *    short settle delay (never on the very first page view);
 *  - straight away at "moments" (lib/pwa-client installMoment): just after
 *    finishing sign-up, and after a match;
 *  - not on focused screens (chat composer, swipe deck, forms);
 *  - "Not now" snoozes it for 3 days, then 7, then 30; installing ends it.
 * Each browser gets its own steps (components/app/InstallSteps.tsx): an
 * Install button where the browser offers one, Share → Add to Home Screen on
 * iPhone, the ⋮ menu on other Android browsers, "open in browser" inside
 * Instagram/Facebook. Computers aren't prompted (they get /app links).
 */

const DISMISS_DAYS = 30;
/** Install snoozes grow: 3 days, then 7, then 30. */
const INSTALL_SNOOZE_DAYS = [3, 7, 30];
const KEY_INSTALL_DISMISS_COUNT = 'unbound_pwa_dismiss_count';
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


function store(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
function getItem(k: string): string | null {
  try { return store()?.getItem(k) ?? null; } catch { return null; }
}
function setItem(k: string, v: string) {
  try { store()?.setItem(k, v); } catch { /* private mode */ }
}
function dismissedRecently(key: string, days = DISMISS_DAYS): boolean {
  const at = Number(getItem(key) || 0);
  return at > 0 && Date.now() - at < days * 24 * 60 * 60 * 1000;
}
function installSnoozed(): boolean {
  const n = Number(getItem(KEY_INSTALL_DISMISS_COUNT) || 1);
  return dismissedRecently(KEY_INSTALL_DISMISSED, INSTALL_SNOOZE_DAYS[Math.min(Math.max(n, 1), INSTALL_SNOOZE_DAYS.length) - 1]);
}

const SHEET =
  'fixed z-40 left-3 right-3 md:left-auto md:right-4 md:w-96 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 ' +
  'bg-[#16161D] border border-white/15 rounded-2xl p-4 shadow-2xl shadow-black/60';

export default function PWAInstall() {
  const { status } = useSession();
  const pathname = usePathname();
  const [method, setMethod] = useState<InstallMethod>('desktop');
  const [moment, setMoment] = useState<InstallMoment | null>(null);
  const [mobile, setMobile] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [pushDismissed, setPushDismissed] = useState(true);
  const [eligible, setEligible] = useState(false);
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
    getPushKey().then((k) => { if (!cancelled) setPushKey(k); });
    return () => { cancelled = true; };
  }, [status]);

  const doSubscribe = useCallback(async () => {
    setPushBusy(true);
    try {
      const r = await enableDevicePush();
      setPushStatus(r === 'on' ? 'granted' : r === 'denied' ? 'denied' : 'default');
    } finally { setPushBusy(false); }
  }, []);

  // Already allowed in this browser but not saved yet → subscribe quietly
  useEffect(() => {
    if (!pushKey || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' && !getItem('velour_push_ok')) doSubscribe();
  }, [pushKey, doSubscribe]);

  // Setup for signed-in members: SW, visit count, install event listeners.
  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') return;

    registerServiceWorker();
    if ('Notification' in window) {
      setPushStatus(Notification.permission as 'default' | 'granted' | 'denied');
    }

    // The old prompt's "dismiss" was permanent; restart it as a 30-day snooze.
    if (getItem(LEGACY_DISMISSED)) {
      setItem(KEY_INSTALL_DISMISSED, String(Date.now()));
      setItem(KEY_PUSH_DISMISSED, String(Date.now()));
      try { store()?.removeItem(LEGACY_DISMISSED); } catch { /* ignore */ }
    }

    // Visits are still counted (used by other prompts / analytics).
    let visits = Number(getItem(KEY_VISITS) || 0);
    let newSession = false;
    try { newSession = !sessionStorage.getItem(KEY_SESSION); sessionStorage.setItem(KEY_SESSION, '1'); } catch { /* ignore */ }
    if (newSession) { visits += 1; setItem(KEY_VISITS, String(visits)); }

    // Opened from the home screen: count it, never prompt.
    if (isStandalone()) { reportAppUse('opened'); setItem(KEY_INSTALLED, '1'); }

    setMobile(isMobileDevice());
    setMethod(installMethod());
    setInstallDismissed(isStandalone() || installSnoozed());
    setPushDismissed(dismissedRecently(KEY_PUSH_DISMISSED));
    setEligible(!isStandalone());

    // A moment queued before this mounted (e.g. onboarding → /members).
    try {
      const m = sessionStorage.getItem('unbound_install_moment') as InstallMoment | null;
      if (m) { sessionStorage.removeItem('unbound_install_moment'); setMoment(m); }
    } catch { /* ignore */ }

    // lib/pwa-client keeps the browser's install offer; it also handles `appinstalled`.
    const onAvailable = () => {
      setMethod(installMethod());
      if (getItem(KEY_INSTALLED) && !isStandalone()) setInstallDismissed(true);
    };
    const onMoment = (e: Event) => {
      const m = (e as CustomEvent<InstallMoment>).detail;
      try { sessionStorage.removeItem('unbound_install_moment'); } catch { /* ignore */ }
      setMoment(m);
    };
    const onEngaged = () => { setItem(KEY_ENGAGED, '1'); };
    window.addEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
    window.addEventListener(INSTALL_MOMENT_EVENT, onMoment);
    window.addEventListener('unbound:engaged', onEngaged);
    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
      window.removeEventListener(INSTALL_MOMENT_EVENT, onMoment);
      window.removeEventListener('unbound:engaged', onEngaged);
    };
  }, [status]);

  // Opening a conversation counts as a first match/message.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (/^\/messages\/[^/]+/.test(pathname)) setItem(KEY_ENGAGED, '1');
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
    setItem(KEY_INSTALL_DISMISS_COUNT, String(Number(getItem(KEY_INSTALL_DISMISS_COUNT) || 0) + 1));
    setInstallDismissed(true);
    setMoment(null);
  }, []);

  const dismissPush = useCallback(() => {
    setItem(KEY_PUSH_DISMISSED, String(Date.now()));
    setPushDismissed(true);
  }, []);

  async function enablePush() {
    if (!pushKey) return;
    await doSubscribe();
  }

  // Never on top of the first-run tour (components/tour): wait until it closes.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (status !== 'authenticated') return;
    const check = () => setTourOpen(!!document.querySelector('[data-tour-root]'));
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, [status]);

  const quiet = QUIET_PATHS.some((p) => pathname.startsWith(p));

  const visible = status === 'authenticated' && (ready || !!moment) && !quiet && !tourOpen;
  // Phones only; computers get the /app link in the menu instead.
  const showInstall = visible && eligible && mobile && !installDismissed && method !== 'installed' && method !== 'desktop';
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
    const title = moment === 'welcome' ? 'Last step: get the Unbound app' : moment === 'match' ? 'Don’t miss their reply' : 'Get the Unbound app';
    return (
      <section role="dialog" aria-modal="false" aria-labelledby="pwa-install-title" aria-describedby="pwa-install-desc" className={SHEET} data-testid="install-sheet">
        <div className="flex items-start gap-3">
          <LogoMark size="sm" />
          <div className="flex-1 min-w-0">
            <h2 id="pwa-install-title" className="text-white text-sm font-semibold">{title}</h2>
            <p id="pwa-install-desc" className="text-white/65 text-xs mt-0.5 leading-relaxed">
              Free, no app store. Add it to your home screen in a few seconds.
            </p>
          </div>
          <button onClick={dismissInstall} className="-mr-1 -mt-1 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors" aria-label="Not now">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <ul className="mt-2.5 grid grid-cols-1 gap-1 text-[11px] text-white/70">
          {['Alerts when someone messages or matches with you', 'Opens full-screen in one tap', 'Discreet: alerts can hide names and messages'].map((t) => (
            <li key={t} className="flex items-center gap-1.5"><Check size={12} className="text-emerald-400 shrink-0" aria-hidden="true" />{t}</li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl bg-white/[0.04] border border-white/10 p-3">
          <InstallSteps method={method} compact onInstalled={() => setInstallDismissed(true)} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <Link href="/app" className="text-white/50 hover:text-white text-[11px] underline-offset-2 hover:underline">More help</Link>
          <button onClick={dismissInstall} className="text-white/70 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Not now</button>
        </div>
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
