'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Lock, LogOut, X, Images } from 'lucide-react';
import Modal from './Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { api, type PersonSummary } from '@/components/gallery/types';
import { Spinner, btnGhost, btnPrimary } from '@/components/gallery/ui';
import { useToast } from '@/lib/toast-context';

interface ViewerPhoto { id: string; url: string; thumbnailUrl?: string | null; caption?: string | null }
interface AlbumData {
  album: { id: string; name: string; description?: string | null; isPrivate: boolean; photoCount: number; owner: PersonSummary };
  photos: ViewerPhoto[];
  isOwner: boolean;
  locked: boolean;
  myStatus: string | null;
}

interface Props {
  albumId: string | null;
  onClose: () => void;
  /** Called after the viewer leaves a shared album. */
  onLeft?: (albumId: string) => void;
  /** Called after the viewer requests access. */
  onRequested?: (albumId: string) => void;
}

/** Modal showing someone else's album (watermarked), or a locked state with "Request access". */
export default function AlbumViewer({ albumId, onClose, onLeft, onRequested }: Props) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const watermark = (session?.user as { username?: string } | undefined)?.username ?? 'unbound';
  const [data, setData] = useState<AlbumData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState<number | null>(null);

  const load = useCallback(async (id: string) => {
    setData(null);
    setError('');
    try {
      setData(await api<AlbumData>(`/api/albums/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Album not found');
    }
  }, []);

  useEffect(() => { if (albumId) { setIndex(null); load(albumId); } }, [albumId, load]);

  async function requestAccess() {
    if (!data) return;
    setBusy(true);
    try {
      const d = await api<{ status: string }>(`/api/albums/${data.album.id}/request`, { method: 'POST' });
      setData({ ...data, myStatus: d.status });
      if (d.status === 'GRANTED') load(data.album.id);
      else { showToast('Request sent — we’ll let you know if it’s accepted', 'success'); onRequested?.(data.album.id); }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not send request', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!data || !session?.user?.id) return;
    setBusy(true);
    try {
      await api(`/api/albums/${data.album.id}/access/${session.user.id}`, { method: 'DELETE' });
      showToast('You left the album', 'info');
      onLeft?.(data.album.id);
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  const photos = data?.photos ?? [];
  const current = index !== null ? photos[index] : null;

  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === 'ArrowRight') setIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setIndex(null); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, photos.length]);

  const owner = data?.album.owner;
  const sharedPrivate = !!data && data.album.isPrivate && !data.isOwner && data.myStatus === 'GRANTED';

  return (
    <>
      <Modal
        open={!!albumId}
        onClose={onClose}
        size="xl"
        title={data?.album.name ?? (error ? 'Album unavailable' : 'Loading album…')}
        description={owner ? `${data?.album.isPrivate ? 'Private album' : 'Album'} by ${owner.displayName} · ${data?.album.photoCount} photo${data?.album.photoCount === 1 ? '' : 's'}` : undefined}
        footer={sharedPrivate ? (
          <button type="button" onClick={leave} disabled={busy} className={btnGhost}>
            <LogOut size={15} aria-hidden="true" /> Leave album
          </button>
        ) : undefined}
      >
        {error ? (
          <p className="text-white/60 text-sm py-8 text-center">{error}</p>
        ) : !data ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-xl skeleton" />)}
          </div>
        ) : data.locked ? (
          <div className="text-center py-10 px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4">
              <Lock size={26} className="text-[#D4AF37]" aria-hidden="true" />
            </div>
            <p className="text-white font-semibold mb-1">This album is private</p>
            <p className="text-white/60 text-sm mb-6 max-w-xs mx-auto">
              {data.myStatus === 'REQUESTED'
                ? `You’ve asked ${owner?.displayName} for access. You’ll get a notification if they say yes.`
                : data.myStatus === 'DECLINED'
                ? 'Your last request wasn’t accepted.'
                : `Ask ${owner?.displayName} to share these ${data.album.photoCount} photos with you.`}
            </p>
            {data.myStatus !== 'REQUESTED' && (
              <button type="button" onClick={requestAccess} disabled={busy} className={btnPrimary}>
                {busy ? <Spinner /> : <Lock size={15} aria-hidden="true" />} Request access
              </button>
            )}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-10">
            <Images size={32} className="text-white/20 mx-auto mb-3" aria-hidden="true" />
            <p className="text-white/60 text-sm">No photos in this album yet.</p>
          </div>
        ) : (
          <>
            {data.album.description && <p className="text-white/70 text-sm mb-4">{data.album.description}</p>}
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {photos.map((p, i) => (
                <li key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
                  <ProtectedImage src={p.thumbnailUrl ?? p.url} alt={p.caption || `Photo ${i + 1}`} className="w-full h-full" watermark={watermark} />
                  <button type="button" onClick={() => setIndex(i)} aria-label={`Open ${p.caption || `photo ${i + 1}`}`} className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:-outline-offset-2 rounded-xl" />
                </li>
              ))}
            </ul>
            {owner && !data.isOwner && (
              <p className="text-white/50 text-xs mt-4">
                Shared by <Link href={`/members/${owner.username}`} className="text-white/80 hover:text-white underline-offset-2 hover:underline">@{owner.username}</Link>. Please don’t screenshot or share.
              </p>
            )}
          </>
        )}
      </Modal>

      {current && index !== null && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={current.caption || `Photo ${index + 1} of ${photos.length}`}>
          <button type="button" onClick={() => setIndex(null)} aria-label="Close photo" className="absolute top-3 right-3 p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <X size={22} />
          </button>
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} aria-label="Previous photo" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 glass rounded-full text-white/80 hover:text-white">
              <ChevronLeft size={22} />
            </button>
          )}
          <figure className="flex flex-col items-center gap-3 px-12 sm:px-16 max-w-full">
            <ProtectedImage src={current.url} alt={current.caption || `Photo ${index + 1}`} className="max-h-[78dvh] max-w-[88vw] rounded-2xl [&_img]:object-contain" watermark={watermark} loading="eager" />
            <figcaption className="text-white/70 text-sm text-center">
              {current.caption && <span className="block text-white/85">{current.caption}</span>}
              <span className="text-white/40 text-xs">{index + 1} / {photos.length}</span>
            </figcaption>
          </figure>
          {index < photos.length - 1 && (
            <button type="button" onClick={() => setIndex(index + 1)} aria-label="Next photo" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 glass rounded-full text-white/80 hover:text-white">
              <ChevronRight size={22} />
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
