'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Upload, X } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';

interface PickerPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  isProfile: boolean;
  isPrivate: boolean;
}

/**
 * "Change profile photo" sheet: upload a new picture or pick one of your
 * public photos. Private photos can't be a profile photo, so they're not offered.
 */
export default function ProfilePhotoPicker({
  photos, busy, error, onUpload, onPick, onClose,
}: {
  photos: PickerPhoto[];
  busy: boolean;
  error: string;
  onUpload: () => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const publicPhotos = photos.filter((p) => !p.isPrivate);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  // Portal to <body> so animated (transformed) ancestors can't trap the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#121218] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="pp-title" className="text-white font-serif text-xl font-bold">Profile photo</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70">
            <X size={18} />
          </button>
        </div>

        <button
          onClick={onUpload}
          disabled={busy}
          className="btn-crimson w-full py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" /> Uploading…</>
          ) : (
            <><Upload size={16} aria-hidden="true" /> Upload a new photo</>
          )}
        </button>
        <p className="text-white/45 text-xs mt-2 text-center">A clear, recent photo of your face (or both of you) gets the most attention.</p>

        {error && <p role="alert" className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

        {publicPhotos.length > 0 && (
          <>
            <p className="text-white/70 text-sm font-medium mt-5 mb-2">Or choose one of your photos</p>
            <ul className="grid grid-cols-3 gap-2">
              {publicPhotos.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => !p.isProfile && onPick(p.id)}
                    disabled={busy}
                    aria-pressed={p.isProfile}
                    aria-label={p.isProfile ? 'Current profile photo' : 'Use this photo as profile photo'}
                    className={`relative block w-full aspect-square rounded-xl overflow-hidden border-2 transition-colors ${p.isProfile ? 'border-[#DC143C]' : 'border-transparent hover:border-white/40'}`}
                  >
                    <ProtectedImage src={p.thumbnailUrl || p.url} alt="" className="w-full h-full" />
                    {p.isProfile && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#DC143C] flex items-center justify-center">
                        <Check size={14} className="text-white" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {photos.some((p) => p.isPrivate) && (
          <p className="text-white/40 text-xs mt-3">Private photos can&apos;t be used as your profile photo.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
