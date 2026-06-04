'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedImage from '@/components/ProtectedImage';
import { Images, X, ChevronLeft, ChevronRight, User } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface GalleryPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt: string;
  user: {
    username: string;
    profile?: {
      displayName?: string;
      profilePhoto?: string;
    };
  };
}

export default function GalleryPage() {
  const { data: session } = useSession();
  const watermark = (session?.user as { username?: string })?.username ?? session?.user?.email ?? 'velour';
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gallery?page=${p}`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos);
        setTotalPages(data.pagination.pages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  function openLightbox(idx: number) { setLightbox(idx); }
  function closeLightbox() { setLightbox(null); }
  function prevPhoto() { setLightbox((i) => (i !== null && i > 0 ? i - 1 : i)); }
  function nextPhoto() { setLightbox((i) => (i !== null && i < photos.length - 1 ? i + 1 : i)); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightbox === null) return;
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'Escape') closeLightbox();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  const current = lightbox !== null ? photos[lightbox] : null;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16">
        {/* Header */}
        <div className="glass-dark border-b border-white/5 px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#DC143C]/20 rounded-xl flex items-center justify-center">
                <Images size={20} className="text-[#DC143C]" />
              </div>
              <div>
                <h1 className="text-white text-xl font-bold font-serif">Member Gallery</h1>
                <p className="text-white/40 text-sm">Browse photos shared by our members</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-24">
              <Images size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-lg">No photos yet</p>
              <p className="text-white/20 text-sm mt-1">Members haven&apos;t shared any public photos yet</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer group relative bg-white/5"
                    onClick={() => openLightbox(idx)}
                  >
                    <ProtectedImage
                      src={photo.thumbnailUrl ?? photo.url}
                      alt={photo.caption || photo.user.username}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                      watermark={watermark}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                      <p className="text-white text-xs font-medium truncate">
                        @{photo.user.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="glass px-4 py-2 rounded-xl text-white/60 hover:text-white text-sm disabled:opacity-30 transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-white/40 text-sm px-4">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="glass px-4 py-2 rounded-xl text-white/60 hover:text-white text-sm disabled:opacity-30 transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white p-2"
            onClick={closeLightbox}
          >
            <X size={24} />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 glass rounded-full"
            onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
          >
            <ChevronLeft size={24} />
          </button>

          <div
            className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ProtectedImage
              src={current.url}
              alt={current.caption || current.user.username}
              className="max-h-[75vh] max-w-[90vw] rounded-2xl"
              watermark={watermark}
            />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#DC143C]/30 flex items-center justify-center">
                {current.user.profile?.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.user.profile.profilePhoto} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User size={14} className="text-white/60" />
                )}
              </div>
              <Link
                href={`/members/${current.user.username}`}
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                @{current.user.username}
              </Link>
              {current.caption && (
                <p className="text-white/40 text-sm">— {current.caption}</p>
              )}
            </div>
          </div>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 glass rounded-full"
            onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
