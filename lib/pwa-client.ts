'use client';

/**
 * Browser-side helpers for "Unbound as an app": install to home screen and
 * phone notifications (web push). Shared by the install/push sheets
 * (components/PWAInstall.tsx), Settings (components/AppSettingsCard.tsx) and
 * the chat's "notify me when they reply" nudge.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALL_AVAILABLE_EVENT = 'unbound:install-available';
export const PUSH_CHANGED_EVENT = 'unbound:push-changed';
const KEY_INSTALLED = 'unbound_pwa_installed';
const KEY_PUSH_OK = 'velour_push_ok';

function ls(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
export function getLocal(k: string): string | null {
  try { return ls()?.getItem(k) ?? null; } catch { return null; }
}
export function setLocal(k: string, v: string) {
  try { ls()?.setItem(k, v); } catch { /* private mode */ }
}
export function removeLocal(k: string) {
  try { ls()?.removeItem(k); } catch { /* private mode */ }
}

// The browser fires `beforeinstallprompt` once, early. Keep it for whichever
// screen offers "Install" (the sheet or Settings).
let installPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    setLocal(KEY_INSTALLED, '1');
    reportAppUse('installed');
    window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
  });
}

export function canPromptInstall(): boolean {
  return !!installPrompt;
}

/** Shows the browser's install dialog. Returns 'unavailable' when the browser hasn't offered one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const p = installPrompt;
  if (!p) return 'unavailable';
  await p.prompt();
  const { outcome } = await p.userChoice;
  installPrompt = null;
  if (outcome === 'accepted') setLocal(KEY_INSTALLED, '1');
  window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
  return outcome;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function wasInstalled(): boolean {
  return isStandalone() || !!getLocal(KEY_INSTALLED);
}

/** The browser can do web push here (on iPhone only once added to the home screen). */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iPhone/iPad in Safari: push needs the home-screen app first. */
export function pushNeedsInstall(): boolean {
  return isIOS() && !isStandalone();
}

let pushKeyPromise: Promise<string> | null = null;
/** The server's VAPID public key, or '' when push is switched off on the server. */
export function getPushKey(): Promise<string> {
  if (!pushKeyPromise) {
    pushKeyPromise = fetch('/api/push', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean; publicKey?: string } | null) => (d?.enabled && d.publicKey ? d.publicKey : ''))
      .catch(() => { pushKeyPromise = null; return ''; });
  }
  return pushKeyPromise;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function registerServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }
}

/** Subscribes this device and saves it on the server (asks permission if needed). */
export async function enablePush(): Promise<'on' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  const key = await getPushKey();
  if (!key) return 'unsupported';
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') { window.dispatchEvent(new Event(PUSH_CHANGED_EVENT)); return 'denied'; }
  try {
    registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
    });
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    if (!res.ok) return 'error';
    setLocal(KEY_PUSH_OK, '1');
    window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));
    return 'on';
  } catch {
    return 'error';
  }
}

/** Unsubscribes this device only (other devices keep their alerts). */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } finally {
    removeLocal(KEY_PUSH_OK);
    window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));
  }
}

/** 'on' = this device is subscribed; 'blocked' = the member blocked notifications for the site. */
export async function pushState(): Promise<'on' | 'off' | 'blocked' | 'needs-install' | 'unsupported'> {
  if (pushNeedsInstall()) return 'needs-install';
  if (!pushSupported() || !(await getPushKey())) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Number on the home-screen icon (installed app). Ignored where unsupported. */
export function setAppBadge(n: number) {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }) : null;
  if (!nav?.setAppBadge) return;
  (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge?.() ?? Promise.resolve()).catch(() => {});
}

/** Sends a test alert to this device. Returns an error message, or null when sent. */
export async function sendTestPush(): Promise<string | null> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return 'Turn notifications on first';
    const res = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    if (res.ok) return null;
    const d = await res.json().catch(() => ({})) as { error?: string };
    return d.error || 'Couldn’t send a test — please try again';
  } catch {
    return 'Couldn’t send a test — please try again';
  }
}

// ── Device detection for install instructions ───────────────────────────────

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  return isIOS() || isAndroid() || (typeof navigator !== 'undefined' && /Mobi/i.test(navigator.userAgent));
}

/** Facebook / Instagram / TikTok etc. in-app browsers can't add to the home screen. */
export function inAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|Twitter|LinkedInApp|WhatsApp/i.test(navigator.userAgent);
}

/** Which install steps to show on this device. */
export type InstallMethod = 'prompt' | 'ios-safari' | 'ios-other' | 'android-menu' | 'in-app' | 'desktop' | 'installed';

export function installMethod(): InstallMethod {
  if (isStandalone()) return 'installed';
  if (inAppBrowser()) return 'in-app';
  if (canPromptInstall()) return 'prompt';
  if (isIOS()) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent) ? 'ios-other' : 'ios-safari';
  if (isAndroid()) return 'android-menu';
  return 'desktop';
}

// ── "Using the app" tracking (Profile.appInstalledAt / appLastOpenedAt) ──────

let reported = false;
/** Tells the server this member opened the installed app (once per session) or just installed it. */
export function reportAppUse(event: 'opened' | 'installed') {
  if (typeof window === 'undefined') return;
  if (event === 'opened') {
    if (reported) return;
    try { if (sessionStorage.getItem('unbound_app_reported')) return; sessionStorage.setItem('unbound_app_reported', '1'); } catch { /* ignore */ }
    reported = true;
  }
  fetch('/api/app/opened', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }), keepalive: true }).catch(() => {});
}

// ── Install-prompt moments ───────────────────────────────────────────────────

export const INSTALL_MOMENT_EVENT = 'unbound:install-moment';
export type InstallMoment = 'welcome' | 'match';

/** Ask the install sheet to show now (e.g. just after sign-up or a match), if it may. */
export function installMoment(m: InstallMoment) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem('unbound_install_moment', m); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(INSTALL_MOMENT_EVENT, { detail: m }));
}
