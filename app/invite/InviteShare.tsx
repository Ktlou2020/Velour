'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';

/** Invite link with copy, native share (where supported) and WhatsApp. */
export default function InviteShare({ link, shareText }: { link: string; shareText: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older browsers: select the field so the member can copy it themselves.
      const el = document.getElementById('invite-link') as HTMLInputElement | null;
      el?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await navigator.share({ title: 'Join me on Unbound', text: shareText, url: link });
    } catch {
      // Dismissed — nothing to do.
    }
  }

  const btn = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px]';
  return (
    <div>
      <div className="flex gap-2">
        <label htmlFor="invite-link" className="sr-only">Your invite link</label>
        <input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="input-dark w-full min-w-0 font-mono text-sm"
        />
        <button type="button" onClick={copy} className={`${btn} btn-crimson shrink-0`} aria-label={copied ? 'Link copied' : 'Copy invite link'}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <p aria-live="polite" className="sr-only">{copied ? 'Invite link copied' : ''}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {canShare && (
          <button type="button" onClick={share} className={`${btn} glass border border-white/15 text-white hover:bg-white/5`}>
            <Share2 size={16} aria-hidden="true" />Share
          </button>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} bg-[#25D366]/15 border border-[#25D366]/30 text-[#7EE2A8] hover:bg-[#25D366]/25`}
        >
          <MessageCircle size={16} aria-hidden="true" />Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
