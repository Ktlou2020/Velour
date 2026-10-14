'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Images, Lock, Clock, FolderLock } from 'lucide-react';
import AlbumViewer from './AlbumViewer';
import { api } from '@/components/gallery/types';
import { Spinner } from '@/components/gallery/ui';
import { useToast } from '@/lib/toast-context';

interface MemberAlbum {
  id: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  photoCount: number;
  coverUrl: string | null;
  locked: boolean;
  myStatus: string | null;
}

interface Props {
  /** The member whose albums to show. */
  username: string;
  /** Section heading (default "Albums"). */
  title?: string;
  className?: string;
}

/**
 * A member's albums as the viewer may see them: public albums open, private
 * albums shown as locked tiles with a "Request access" button unless access
 * was granted. Renders nothing when the member has no albums.
 *
 *   <MemberAlbums username={user.username} />
 */
export default function MemberAlbums({ username, title = 'Albums', className = '' }: Props) {
  const { showToast } = useToast();
  const [albums, setAlbums] = useState<MemberAlbum[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ albums: MemberAlbum[]; isOwner: boolean }>(`/api/albums/user/${encodeURIComponent(username)}`);
      setAlbums(d.albums);
      setIsOwner(d.isOwner);
    } catch {
      setAlbums([]);
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (id: string, myStatus: string) =>
    setAlbums((list) => list?.map((a) => (a.id === id ? { ...a, myStatus } : a)) ?? null);

  async function request(a: MemberAlbum) {
    setBusyId(a.id);
    try {
      const d = await api<{ status: string }>(`/api/albums/${a.id}/request`, { method: 'POST' });
      setStatus(a.id, d.status);
      if (d.status === 'GRANTED') load();
      else showToast('Request sent — we’ll let you know if it’s accepted', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not send request', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (albums === null) {
    return (
      <section className={className} aria-busy="true" aria-label={title}>
        <div className="h-5 w-24 rounded skeleton mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] rounded-2xl skeleton" />)}
        </div>
      </section>
    );
  }
  if (albums.length === 0) return null;

  return (
    <section className={className} aria-labelledby={`albums-${username}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 id={`albums-${username}`} className="text-white font-semibold flex items-center gap-2">
          <Images size={16} className="text-[#FF4D6D]" aria-hidden="true" /> {title}
          <span className="text-white/40 text-sm font-normal">({albums.length})</span>
        </h2>
        {isOwner && <Link href="/gallery?tab=albums" className="text-sm text-[#D4AF37] hover:text-[#e8c547]">Manage</Link>}
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {albums.map((a) => (
          <li key={a.id} className="relative">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              {a.locked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1b1020] via-[#14101a] to-[#0f0f16]">
                  <FolderLock size={28} className="text-[#D4AF37]/80 mb-1" aria-hidden="true" />
                  <span className="text-white/60 text-xs">{a.photoCount} private photo{a.photoCount === 1 ? '' : 's'}</span>
                </div>
              ) : a.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.coverUrl} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover pointer-events-none select-none" onContextMenu={(e) => e.preventDefault()} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Images size={26} className="text-white/20" aria-hidden="true" /></div>
              )}
              {a.isPrivate && !a.locked && (
                <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 text-[#D4AF37] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  <Lock size={9} aria-hidden="true" /> Shared with you
                </span>
              )}
              {!a.locked && (
                <button type="button" onClick={() => setOpenId(a.id)} className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] rounded-2xl" aria-label={`Open album ${a.name}, ${a.photoCount} photos`} />
              )}
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{a.name}</p>
                <p className="text-white/45 text-xs">{a.photoCount} photo{a.photoCount === 1 ? '' : 's'}{a.isPrivate ? ' · private' : ''}</p>
              </div>
            </div>
            {a.locked && (
              a.myStatus === 'REQUESTED' ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-white/55"><Clock size={12} aria-hidden="true" /> Requested</p>
              ) : (
                <button
                  type="button"
                  onClick={() => request(a)}
                  disabled={busyId === a.id}
                  className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0A0A0F] bg-[#D4AF37] hover:bg-[#e8c547] rounded-lg py-2 transition-colors disabled:opacity-60"
                  aria-label={`Request access to ${a.name}`}
                >
                  {busyId === a.id ? <Spinner size={12} /> : <Lock size={12} aria-hidden="true" />} Request access
                </button>
              )
            )}
          </li>
        ))}
      </ul>

      <AlbumViewer
        albumId={openId}
        onClose={() => setOpenId(null)}
        onLeft={() => load()}
        onRequested={(id) => setStatus(id, 'REQUESTED')}
      />
    </section>
  );
}
