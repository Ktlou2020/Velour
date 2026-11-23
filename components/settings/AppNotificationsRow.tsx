'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smartphone, ChevronRight, CheckCircle, Bell, BellOff, Share, PlusSquare, Download } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import {
  INSTALL_AVAILABLE_EVENT, PUSH_CHANGED_EVENT, canPromptInstall, disablePush, enablePush, isIOS, isStandalone,
  promptInstall, pushState, registerServiceWorker, sendTestPush, wasInstalled,
} from '@/lib/pwa-client';

type PushUi = Awaited<ReturnType<typeof pushState>> | 'loading';

/**
 * Settings → "App & notifications": add Unbound to the home screen and turn
 * phone alerts on/off for this device, any time (not just when a prompt shows).
 * Opens automatically when the page is reached via /account#app.
 */
export default function AppNotificationsRow() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState<PushUi>('loading');
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discreet, setDiscreet] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    setCanInstall(canPromptInstall());
    setInstalled(wasInstalled());
    setStandalone(isStandalone());
    pushState().then(setPush);
  }, []);

  useEffect(() => {
    registerServiceWorker();
    setIos(isIOS());
    refresh();
    if (window.location.hash === '#app') setOpen(true);
    fetch('/api/settings/discreet-alerts').then((r) => (r.ok ? r.json() : null)).then((d) => setDiscreet(!!d?.discreet)).catch(() => setDiscreet(false));
    window.addEventListener(INSTALL_AVAILABLE_EVENT, refresh);
    window.addEventListener(PUSH_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, refresh);
      window.removeEventListener(PUSH_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  async function turnOn() {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === 'on') showToast('Notifications are on for this device', 'success');
      else if (r === 'denied') showToast('Notifications were blocked — see the steps below to allow them', 'error');
      else if (r === 'error') showToast('Couldn’t turn on notifications — please try again', 'error');
      refresh();
    } finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true);
    try { await disablePush(); showToast('Notifications are off for this device', 'success'); refresh(); } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    try {
      const err = await sendTestPush();
      showToast(err ?? 'Test sent — it should arrive in a few seconds', err ? 'error' : 'success');
    } finally { setBusy(false); }
  }

  async function toggleDiscreet() {
    if (discreet === null) return;
    const next = !discreet;
    setDiscreet(next);
    const res = await fetch('/api/settings/discreet-alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discreet: next }) }).catch(() => null);
    if (!res?.ok) { setDiscreet(!next); showToast('Couldn’t save — please try again', 'error'); }
  }

  async function install() {
    const r = await promptInstall();
    if (r === 'accepted') showToast('Unbound is on your home screen', 'success');
    refresh();
  }

  const status =
    push === 'on' ? 'Notifications on' :
    standalone ? 'App installed' :
    push === 'needs-install' ? 'Add to home screen for alerts' :
    'Install the app and get alerts';

  const btn = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60';
  const step = 'w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0';

  return (
    <details id="app" className="group glass rounded-2xl scroll-mt-24" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex items-center gap-3 p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <Smartphone size={18} className="text-[#DC143C]" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-white font-semibold text-sm">App &amp; notifications</span>
          <span className="block text-white/55 text-xs">{status}</span>
        </span>
        <ChevronRight size={16} className="text-white/40 ml-auto transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>

      <div className="px-5 pb-5 space-y-5">
        {/* Home screen */}
        <section aria-labelledby="app-install-h">
          <h3 id="app-install-h" className="text-white/85 text-sm font-semibold mb-1.5">Home screen app</h3>
          {standalone ? (
            <p className="text-emerald-300 text-sm flex items-center gap-2"><CheckCircle size={15} aria-hidden="true" /> You&apos;re using the Unbound app.</p>
          ) : canInstall ? (
            <>
              <p className="text-white/60 text-sm mb-3">Open Unbound full-screen from your home screen, like an app. No app store needed.</p>
              <button type="button" onClick={install} className={`${btn} bg-[#DC143C] hover:bg-[#FF1744] text-white`}>
                <Download size={15} aria-hidden="true" /> Add to home screen
              </button>
            </>
          ) : ios ? (
            <>
              <p className="text-white/60 text-sm mb-2">{installed ? 'Already added? Open Unbound from your home screen.' : 'Open Unbound full-screen like an app — and get message alerts on your iPhone.'}</p>
              <ol className="space-y-2 text-sm text-white/70">
                <li className="flex items-center gap-2"><span className={step} aria-hidden="true">1</span><span>Tap <Share size={13} className="inline -mt-0.5" aria-hidden="true" /> <strong className="text-white/85">Share</strong> in Safari&apos;s toolbar</span></li>
                <li className="flex items-center gap-2"><span className={step} aria-hidden="true">2</span><span>Choose <PlusSquare size={13} className="inline -mt-0.5" aria-hidden="true" /> <strong className="text-white/85">Add to Home Screen</strong></span></li>
                <li className="flex items-center gap-2"><span className={step} aria-hidden="true">3</span><span>Open Unbound from your home screen</span></li>
              </ol>
            </>
          ) : (
            <p className="text-white/60 text-sm">{installed ? 'Unbound is installed on this device — open it from your home screen or app list.' : 'In your browser menu, choose “Install app” or “Add to Home screen”.'}</p>
          )}
        </section>

        {/* Notifications */}
        <section aria-labelledby="app-push-h">
          <h3 id="app-push-h" className="text-white/85 text-sm font-semibold mb-1.5">Notifications on this device</h3>
          {push === 'loading' ? (
            <p className="text-white/40 text-sm">Checking…</p>
          ) : push === 'on' ? (
            <>
              <p className="text-emerald-300 text-sm flex items-center gap-2 mb-3"><Bell size={15} aria-hidden="true" /> On — you&apos;ll get alerts for new messages and matches.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={test} disabled={busy} className={`${btn} glass text-white/85`}>Send a test</button>
                <button type="button" onClick={turnOff} disabled={busy} className={`${btn} glass text-white/70`}><BellOff size={15} aria-hidden="true" /> Turn off</button>
              </div>
            </>
          ) : push === 'off' ? (
            <>
              <p className="text-white/60 text-sm mb-3">Get an alert when someone messages or matches with you, even when Unbound is closed. Alerts never show photos, and you can hide names and messages below.</p>
              <button type="button" onClick={turnOn} disabled={busy} className={`${btn} bg-[#DC143C] hover:bg-[#FF1744] text-white`}><Bell size={15} aria-hidden="true" /> Turn on notifications</button>
            </>
          ) : push === 'needs-install' ? (
            <p className="text-white/60 text-sm">On iPhone and iPad, alerts work once Unbound is on your home screen. Add it using the steps above, open it from there, then turn notifications on here.</p>
          ) : push === 'blocked' ? (
            <div className="text-white/60 text-sm space-y-1.5">
              <p className="text-amber-300">Notifications are blocked for Unbound on this device.</p>
              {standalone && ios
                ? <p>Open your iPhone&apos;s <strong className="text-white/85">Settings → Notifications → Unbound</strong> and allow notifications.</p>
                : <p>Tap the icon next to the web address (or open your browser&apos;s site settings), set <strong className="text-white/85">Notifications</strong> to <strong className="text-white/85">Allow</strong>, then come back here.</p>}
            </div>
          ) : (
            <p className="text-white/60 text-sm">This browser can&apos;t show notifications. We&apos;ll still email you about new messages.</p>
          )}
        </section>

        {/* Discreet alerts — applies to every device */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={!!discreet} disabled={discreet === null} onChange={toggleDiscreet} className="mt-1 accent-[#DC143C] w-4 h-4" />
          <span>
            <span className="block text-white/85 text-sm font-semibold">Discreet alerts</span>
            <span className="block text-white/55 text-xs leading-relaxed">Alerts just say &ldquo;You have a new notification&rdquo; — no names or message text on your lock screen.</span>
          </span>
        </label>
      </div>
    </details>
  );
}
