'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, X, Bell, Share } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
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

export default function PWAInstall() {
  const { status } = useSession();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'none'>('none');
  const [pushBusy, setPushBusy] = useState(false);

  const doSubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushBusy(true);
    try {
      const keyRes = await fetch('/api/push');
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json() as { publicKey: string };
      if (!publicKey) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushStatus('granted');
      localStorage.setItem('velour_push_ok', '1');
    } catch { /* denied or error */ }
    finally { setPushBusy(false); }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') return;
    if (localStorage.getItem('velour_pwa_dismissed')) setDismissed(true);

    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    // Push permission state
    if ('Notification' in window) {
      setPushStatus(Notification.permission as 'default' | 'granted' | 'denied');
      if (Notification.permission === 'granted' && !localStorage.getItem('velour_push_ok')) {
        doSubscribe();
      }
    }

    // Android install banner
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS guide (3s delay, only if not installed yet)
    if (isIOS() && !isStandalone() && !localStorage.getItem('velour_pwa_dismissed')) {
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handler); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [status, doSubscribe]);

  function dismiss() {
    localStorage.setItem('velour_pwa_dismissed', '1');
    setDismissed(true);
    setPrompt(null);
    setShowIOS(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  }

  async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') await doSubscribe();
    else setPushStatus('denied');
  }

  // iOS install guide
  if (showIOS && !dismissed && !isStandalone()) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 glass border border-white/15 rounded-xl p-4 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center">
              <span className="text-white font-serif font-bold text-sm">V</span>
            </div>
            <p className="text-white text-sm font-semibold">Install Velour</p>
          </div>
          <button onClick={dismiss} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <p className="text-white/60 text-xs mb-3 leading-relaxed">
          Install on your iPhone in two taps:
        </p>
        <div className="space-y-2 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-bold">1</span>
            <span>Tap the</span><Share size={11} className="inline" /><span><strong className="text-white/80">Share</strong> button</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-bold">2</span>
            <span>Tap <strong className="text-white/80">&ldquo;Add to Home Screen&rdquo;</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // Android / desktop install
  if (prompt && !dismissed) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 glass border border-white/15 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-serif font-bold text-base">V</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Install Velour</p>
          <p className="text-white/50 text-xs">Add to your home screen</p>
        </div>
        <button onClick={install} className="flex items-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
          <Download size={12} />Install
        </button>
        <button onClick={dismiss} className="text-white/40 hover:text-white transition-colors flex-shrink-0" aria-label="Dismiss"><X size={16} /></button>
      </div>
    );
  }

  // Push notification opt-in
  if (status === 'authenticated' && !dismissed && pushStatus === 'default' && 'Notification' in window) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 glass border border-[#DC143C]/20 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
        <div className="w-9 h-9 rounded-lg bg-[#DC143C]/20 flex items-center justify-center flex-shrink-0">
          <Bell size={16} className="text-[#DC143C]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Enable Notifications</p>
          <p className="text-white/50 text-xs">Get alerts for matches &amp; messages</p>
        </div>
        <button onClick={enablePush} disabled={pushBusy} className="flex items-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-70">
          {pushBusy
            ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            : <Bell size={12} />}
          Enable
        </button>
        <button onClick={dismiss} className="text-white/40 hover:text-white transition-colors flex-shrink-0" aria-label="Dismiss"><X size={16} /></button>
      </div>
    );
  }

  return null;
}
