'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('velour_pwa_dismissed')) {
      setDismissed(true);
      return;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ignore */});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    localStorage.setItem('velour_pwa_dismissed', '1');
    setDismissed(true);
    setDeferredPrompt(null);
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 glass border border-white/15 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center flex-shrink-0">
        <span className="text-white font-serif font-bold text-base">V</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">Install Velour</p>
        <p className="text-white/50 text-xs">Add to your home screen</p>
      </div>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
      >
        <Download size={12} />
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="text-white/40 hover:text-white transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
