'use client';

import { useEffect, useId, useState } from 'react';
import { Star, Trash2, Lock, Globe, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '@/components/albums/Modal';
import { api, type AlbumSummary, type GalleryPhoto } from './types';
import { Spinner, Switch, btnDanger, btnGhost, btnPrimary } from './ui';
import { useToast } from '@/lib/toast-context';

interface Props {
  photo: GalleryPhoto | null;
  albums: AlbumSummary[];
  /** When opened from inside an album: offer "Use as album cover". */
  albumContext?: AlbumSummary | null;
  onClose: () => void;
  onUpdated: (photo: GalleryPhoto, opts?: { mainChanged?: boolean }) => void;
  onDeleted: (id: string) => void;
  onCoverSet?: (albumId: string, photoId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function PhotoSheet({ photo, albums, albumContext, onClose, onUpdated, onDeleted, onCoverSet, onPrev, onNext }: Props) {
  const { showToast } = useToast();
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const captionId = useId();
  const albumSelectId = useId();

  useEffect(() => {
    setCaption(photo?.caption ?? '');
    setConfirmDelete(false);
  }, [photo?.id, photo?.caption]);

  if (!photo) return null;
  const album = albums.find((a) => a.id === photo.albumId) ?? null;

  async function patch(body: Record<string, unknown>, label: string, opts?: { mainChanged?: boolean; success?: string }) {
    if (!photo) return;
    setBusy(label);
    try {
      const d = await api<{ photo: GalleryPhoto }>(`/api/photos/${photo.id}`, { method: 'PATCH', json: body });
      onUpdated({ ...photo, ...d.photo }, opts);
      if (opts?.success) showToast(opts.success, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!photo) return;
    setBusy('delete');
    try {
      await api(`/api/photos/${photo.id}`, { method: 'DELETE' });
      onDeleted(photo.id);
      showToast('Photo deleted', 'info');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function setCover() {
    if (!photo || !albumContext) return;
    setBusy('cover');
    try {
      await api(`/api/albums/${albumContext.id}`, { method: 'PATCH', json: { coverPhotoId: photo.id } });
      onCoverSet?.(albumContext.id, photo.id);
      showToast('Album cover updated', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not set cover', 'error');
    } finally {
      setBusy(null);
    }
  }

  const captionChanged = caption.trim() !== (photo.caption ?? '');

  return (
    <Modal open={!!photo} onClose={onClose} title="Edit photo" size="lg">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <div className="relative rounded-2xl overflow-hidden bg-black/40 aspect-[4/3] sm:aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.caption || 'Selected photo'} className="w-full h-full object-contain" draggable={false} />
          {onPrev && (
            <button type="button" onClick={onPrev} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/80 hover:text-white"><ChevronLeft size={18} /></button>
          )}
          {onNext && (
            <button type="button" onClick={onNext} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/80 hover:text-white"><ChevronRight size={18} /></button>
          )}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <form onSubmit={(e) => { e.preventDefault(); if (captionChanged) patch({ caption: caption.trim() }, 'caption', { success: 'Caption saved' }); }}>
            <label htmlFor={captionId} className="block text-white/70 text-xs font-medium mb-1.5">Caption</label>
            <textarea
              id={captionId}
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Add a caption (optional)"
              className="input-dark w-full resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-white/35 text-[11px]">{caption.length}/300</span>
              {captionChanged && (
                <button type="submit" disabled={busy === 'caption'} className="text-xs font-semibold text-[#D4AF37] hover:text-[#e8c547] disabled:opacity-50">
                  {busy === 'caption' ? 'Saving…' : 'Save caption'}
                </button>
              )}
            </div>
          </form>

          <div>
            <label htmlFor={albumSelectId} className="block text-white/70 text-xs font-medium mb-1.5">Album</label>
            <select
              id={albumSelectId}
              value={photo.albumId ?? ''}
              disabled={busy === 'album'}
              onChange={(e) => patch({ albumId: e.target.value || null }, 'album', { success: e.target.value ? 'Moved to album' : 'Removed from album' })}
              className="input-dark w-full"
            >
              <option value="">No album</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id} disabled={a.isPrivate && photo.isProfile}>
                  {a.name}{a.isPrivate ? ' (private)' : ''}
                </option>
              ))}
            </select>
            {photo.isProfile && albums.some((a) => a.isPrivate) && (
              <p className="text-white/45 text-[11px] mt-1">Your main photo can’t go in a private album.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 glass rounded-xl px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium flex items-center gap-1.5">
                {photo.isPrivate ? <Lock size={13} aria-hidden="true" /> : <Globe size={13} aria-hidden="true" />}
                {photo.isPrivate ? 'Private' : 'Visible to members'}
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                {album
                  ? `Follows the “${album.name}” album${album.isPrivate ? ' — only people you share it with' : ''}. Changing this takes it out of the album.`
                  : photo.isPrivate
                  ? 'Only you can see it. Put it in a private album to share it with people you choose.'
                  : 'Any signed-in member can see it on your profile.'}
              </p>
            </div>
            <Switch
              checked={photo.isPrivate}
              label="Private photo"
              disabled={busy === 'private' || (photo.isProfile && !photo.isPrivate)}
              onChange={(v) => patch({ isPrivate: v }, 'private', { success: v ? 'Photo is now private' : 'Photo is now visible to members' })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {photo.isProfile ? (
              <span className="inline-flex items-center gap-1.5 text-[#D4AF37] text-sm font-semibold px-1 py-2.5"><Star size={15} aria-hidden="true" /> Main profile photo</span>
            ) : (
              <button
                type="button"
                onClick={() => patch({ isProfile: true }, 'main', { mainChanged: true, success: 'Main photo updated' })}
                disabled={busy === 'main' || photo.isPrivate}
                className={btnPrimary}
                title={photo.isPrivate ? 'Make the photo visible to members first' : undefined}
              >
                {busy === 'main' ? <Spinner /> : <Star size={15} aria-hidden="true" />} Set as main photo
              </button>
            )}
            {albumContext && albumContext.coverPhotoId !== photo.id && photo.albumId === albumContext.id && (
              <button type="button" onClick={setCover} disabled={busy === 'cover'} className={btnGhost}>
                {busy === 'cover' ? <Spinner /> : <ImageIcon size={15} aria-hidden="true" />} Use as album cover
              </button>
            )}
          </div>
          {photo.isPrivate && !photo.isProfile && (
            <p className="text-white/45 text-[11px] -mt-2">Main photos must be visible to members.</p>
          )}

          <div className="mt-auto pt-3 border-t border-white/10">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2" role="alert">
                <p className="text-white/80 text-sm flex-1 min-w-[10rem]">Delete this photo for good?</p>
                <button type="button" onClick={() => setConfirmDelete(false)} className={btnGhost}>Cancel</button>
                <button type="button" onClick={remove} disabled={busy === 'delete'} className={btnDanger}>
                  {busy === 'delete' ? <Spinner /> : <Trash2 size={15} aria-hidden="true" />} Delete
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={btnDanger}>
                <Trash2 size={15} aria-hidden="true" /> Delete photo
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
