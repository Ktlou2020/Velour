'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Heart } from 'lucide-react';
import Modal from '@/components/albums/Modal';
import { Avatar, Spinner, btnGhost } from './ui';

interface Liker { username: string; name: string; avatarUrl: string | null; isVerified: boolean; likedAt: string }

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/** "Liked by" list for one of my photos (owner only — GET /api/photos/<id>/likes). */
export default function LikersSheet({ photoId, onClose }: { photoId: string | null; onClose: () => void }) {
  const [likers, setLikers] = useState<Liker[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (id: string, after: string | null) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/photos/${id}/likes${after ? `?cursor=${encodeURIComponent(after)}` : ''}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not load likes');
      setLikers((cur) => [...(after ? cur ?? [] : []), ...(d.likers as Liker[])]);
      setTotal(d.total ?? 0);
      setCursor(d.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load likes');
      setLikers((cur) => cur ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setLikers(null);
    setCursor(null);
    if (photoId) load(photoId, null);
  }, [photoId, load]);

  return (
    <Modal open={!!photoId} onClose={onClose} title="Liked by" description={likers ? `${total} ${total === 1 ? 'member' : 'members'} liked this photo` : undefined}>
      {likers === null ? (
        <ul className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <li key={i} className="h-12 rounded-xl skeleton" />)}
        </ul>
      ) : likers.length === 0 ? (
        <div className="py-10 text-center">
          <Heart size={28} className="mx-auto mb-3 text-white/25" aria-hidden="true" />
          <p className="text-white/70 text-sm">{error || 'No likes yet. Public photos appear in Explore for members to discover.'}</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-white/5 -mx-1">
            {likers.map((l) => (
              <li key={l.username}>
                <Link href={`/members/${encodeURIComponent(l.username)}`} className="flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-white/5">
                  <Avatar url={l.avatarUrl} name={l.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-white text-sm font-medium">
                      <span className="truncate">{l.name}</span>
                      {l.isVerified && <BadgeCheck size={14} className="text-sky-400 shrink-0" aria-label="Verified" />}
                    </span>
                    <span className="block text-white/45 text-xs truncate">@{l.username}</span>
                  </span>
                  <span className="text-white/40 text-xs shrink-0">{ago(l.likedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="text-red-300 text-sm mt-2">{error}</p>}
          {cursor && (
            <div className="flex justify-center pt-3">
              <button type="button" disabled={busy} onClick={() => photoId && load(photoId, cursor)} className={btnGhost}>
                {busy ? <Spinner /> : null} Show more
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
