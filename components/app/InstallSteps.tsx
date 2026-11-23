'use client';

import { useState } from 'react';
import { Share, PlusSquare, MoreVertical, Download, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { promptInstall, type InstallMethod } from '@/lib/pwa-client';

const num = 'w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`${num} mt-px`} aria-hidden="true">{n}</span>
      <span>{children}</span>
    </li>
  );
}

/**
 * How to add Unbound to the home screen on this device — shared by the
 * install sheet (compact) and the /app page.
 */
export default function InstallSteps({ method, compact = false, onInstalled }: {
  method: InstallMethod;
  compact?: boolean;
  onInstalled?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = compact ? 'text-xs' : 'text-sm';
  const b = 'text-white/90 font-semibold';

  if (method === 'installed') {
    return <p className={`flex items-center gap-2 text-emerald-300 ${text}`}><CheckCircle size={16} aria-hidden="true" /> You&apos;re using the Unbound app.</p>;
  }

  if (method === 'prompt') {
    return (
      <button
        type="button"
        onClick={async () => { if ((await promptInstall()) === 'accepted') onInstalled?.(); }}
        className={`btn-crimson inline-flex items-center gap-2 rounded-xl font-semibold ${compact ? 'text-xs px-4 py-2' : 'text-sm px-5 py-3'}`}
      >
        <Download size={compact ? 14 : 16} aria-hidden="true" /> Install Unbound
      </button>
    );
  }

  if (method === 'in-app') {
    return (
      <div className={`space-y-2 text-white/70 ${text}`}>
        <p>You&apos;re in another app&apos;s browser, which can&apos;t add Unbound to your home screen.</p>
        <ol className="space-y-2">
          <Step n={1}>Tap the <strong className={b}>⋯</strong> menu and choose <strong className={b}>Open in browser</strong> (Safari or Chrome)</Step>
          <Step n={2}>Then follow the steps there</Step>
        </ol>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/app`).then(() => setCopied(true)).catch(() => {}); }}
          className="inline-flex items-center gap-1.5 text-[#FF4D6D] hover:underline"
        >
          <Copy size={13} aria-hidden="true" /> {copied ? 'Link copied — paste it in your browser' : 'Copy the link'}
        </button>
      </div>
    );
  }

  if (method === 'ios-safari') {
    return (
      <ol className={`space-y-2 text-white/70 ${text}`}>
        <Step n={1}>Tap <Share size={13} className="inline -mt-0.5" aria-label="Share" /> <strong className={b}>Share</strong> at the bottom of Safari</Step>
        <Step n={2}>Scroll down and tap <PlusSquare size={13} className="inline -mt-0.5" aria-hidden="true" /> <strong className={b}>Add to Home Screen</strong>, then <strong className={b}>Add</strong></Step>
        <Step n={3}>Open Unbound from your home screen</Step>
      </ol>
    );
  }

  if (method === 'ios-other') {
    return (
      <div className={`space-y-2 text-white/70 ${text}`}>
        <ol className="space-y-2">
          <Step n={1}>Tap <Share size={13} className="inline -mt-0.5" aria-label="Share" /> <strong className={b}>Share</strong> next to the address bar</Step>
          <Step n={2}>Tap <PlusSquare size={13} className="inline -mt-0.5" aria-hidden="true" /> <strong className={b}>Add to Home Screen</strong></Step>
          <Step n={3}>Open Unbound from your home screen</Step>
        </ol>
        <p className="text-white/50">Don&apos;t see it? Open <strong className={b}>unboundza.com</strong> in Safari and try there.</p>
      </div>
    );
  }

  if (method === 'android-menu') {
    return (
      <ol className={`space-y-2 text-white/70 ${text}`}>
        <Step n={1}>Tap the <MoreVertical size={13} className="inline -mt-0.5" aria-label="menu" /> <strong className={b}>menu</strong> at the top right of your browser</Step>
        <Step n={2}>Tap <strong className={b}>Install app</strong> or <strong className={b}>Add to Home screen</strong></Step>
        <Step n={3}>Open Unbound from your home screen</Step>
      </ol>
    );
  }

  // desktop
  return (
    <p className={`text-white/70 ${text}`}>
      Unbound works best on your phone. Open <strong className={b}>unboundza.com/app</strong> there{compact ? '' : ' (or scan the code)'} <ExternalLink size={12} className="inline -mt-0.5" aria-hidden="true" />
    </p>
  );
}
