'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Images, Upload, FolderPlus, Lock, Globe, ArrowLeft, Share2, Pencil, Trash2, Plus,
  ChevronLeft, ChevronRight, ArrowUpDown, Check, X, AlertCircle, FolderOpen, Users, Compass, Clock,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/albums/Modal';
import ShareAlbumDialog from '@/components/albums/ShareAlbumDialog';
import AlbumViewer from '@/components/albums/AlbumViewer';
import PhotoSheet from './PhotoSheet';
import ExploreCard from './ExploreCard';
import LikersSheet from './LikersSheet';
import { useUploads } from './useUploads';
import { api, type AlbumSummary, type GalleryPhoto, type SharedAlbum } from './types';
import { Avatar, GridSkeleton, PhotoTile, Spinner, Switch, btnDanger, btnGhost, btnPrimary } from './ui';
import { useToast } from '@/lib/toast-context';

type Tab = 'photos' | 'albums' | 'shared';
type Filter = 'all' | 'public' | 'private' | 'unsorted';

interface AlbumsResponse { albums: AlbumSummary[]; sharedWithMe: SharedAlbum[]; pendingRequests: number }

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.heic,.heif';

export default function GalleryManager() {
  const router = useRouter();
  const search = useSearchParams();
  const { showToast } = useToast();

  const [tab, setTabState] = useState<Tab>(() => {
    const t = search.get('tab');
    return t === 'albums' || t === 'shared' ? t : 'photos';
  });
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [data, setData] = useState<AlbumsResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(() => (search.get('tab') === 'albums' ? search.get('album') : null));
  const [viewSharedId, setViewSharedId] = useState<string | null>(() => (search.get('tab') === 'shared' ? search.get('album') : null));
  const [shareOpen, setShareOpen] = useState(() => search.get('share') === '1');
  const [albumDialog, setAlbumDialog] = useState<{ mode: 'create' } | { mode: 'edit'; album: AlbumSummary } | null>(null);
  const [pickerFor, setPickerFor] = useState<AlbumSummary | null>(null);
  const [deleteAlbum, setDeleteAlbum] = useState<AlbumSummary | null>(null);
  const [reorder, setReorder] = useState<string[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [likersFor, setLikersFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const albums = useMemo(() => data?.albums ?? [], [data]);
  const albumById = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums]);
  const openAlbum = openAlbumId ? albumById.get(openAlbumId) ?? null : null;

  const setTab = useCallback((t: Tab, extra: Record<string, string> = {}) => {
    setTabState(t);
    setReorder(null);
    if (t !== 'albums') setOpenAlbumId(null);
    const qs = new URLSearchParams({ ...(t !== 'photos' ? { tab: t } : {}), ...extra }).toString();
    router.replace(qs ? `/gallery?${qs}` : '/gallery', { scroll: false });
  }, [router]);

  const loadAlbums = useCallback(async () => {
    try { setData(await api<AlbumsResponse>('/api/albums')); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load albums'); }
  }, []);
  const loadPhotos = useCallback(async () => {
    try { setPhotos((await api<{ photos: GalleryPhoto[] }>('/api/photos')).photos); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load photos'); }
  }, []);
  useEffect(() => { loadPhotos(); loadAlbums(); }, [loadPhotos, loadAlbums]);

  // Album counts after photos move around.
  const bumpCounts = useCallback(() => { loadAlbums(); }, [loadAlbums]);

  const uploads = useUploads(async (r) => {
    const p = r.photo as unknown as GalleryPhoto | undefined;
    if (!p) return;
    let added: GalleryPhoto = { ...p, createdAt: String(p.createdAt) };
    // First public photo becomes the main photo.
    const hasMain = mainAssigned.current || (photosRef.current ?? []).some((x) => x.isProfile);
    if (!hasMain && !added.isPrivate) {
      mainAssigned.current = true;
      try {
        const d = await api<{ photo: GalleryPhoto }>(`/api/photos/${added.id}`, { method: 'PATCH', json: { isProfile: true } });
        added = { ...added, ...d.photo };
      } catch { /* not critical */ }
    }
    setPhotos((cur) => [...(cur ?? []).map((x) => (added.isProfile ? { ...x, isProfile: false } : x)), added]);
    if (added.albumId) bumpCounts();
  });
  const photosRef = useRef(photos);
  const mainAssigned = useRef(false);
  photosRef.current = photos;

  function pickFiles(albumId: string | null = null) {
    uploadTarget.current = albumId;
    fileRef.current?.click();
  }
  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    uploads.add(files, uploadTarget.current ? { albumId: uploadTarget.current } : {});
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Photo updates from the sheet ──────────────────────────────────────
  function onPhotoUpdated(updated: GalleryPhoto, opts?: { mainChanged?: boolean }) {
    setPhotos((cur) => (cur ?? []).map((x) => (x.id === updated.id ? updated : opts?.mainChanged ? { ...x, isProfile: false } : x)));
    const before = photos?.find((x) => x.id === updated.id);
    if (before && before.albumId !== updated.albumId) bumpCounts();
  }
  function onPhotoDeleted(id: string) {
    const was = photos?.find((x) => x.id === id);
    setPhotos((cur) => (cur ?? []).filter((x) => x.id !== id));
    if (was?.isProfile) mainAssigned.current = false;
    if (was?.albumId) bumpCounts();
  }

  // ── Views ─────────────────────────────────────────────────────────────
  const visiblePhotos = useMemo(() => {
    const list = photos ?? [];
    if (tab === 'albums' && openAlbumId) return list.filter((p) => p.albumId === openAlbumId);
    switch (filter) {
      case 'public': return list.filter((p) => !p.isPrivate);
      case 'private': return list.filter((p) => p.isPrivate);
      case 'unsorted': return list.filter((p) => !p.albumId);
      default: return list;
    }
  }, [photos, filter, tab, openAlbumId]);

  const orderedForReorder = useMemo(() => {
    if (!reorder || !photos) return null;
    const map = new Map(photos.map((p) => [p.id, p]));
    return reorder.map((id) => map.get(id)).filter((p): p is GalleryPhoto => !!p);
  }, [reorder, photos]);

  const sheetList = visiblePhotos;
  const sheetIndex = sheetId ? sheetList.findIndex((p) => p.id === sheetId) : -1;
  const sheetPhoto = sheetIndex >= 0 ? sheetList[sheetIndex] : null;

  function move(id: string, dir: -1 | 1) {
    setReorder((cur) => {
      if (!cur) return cur;
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  async function saveOrder() {
    if (!reorder) return;
    setSavingOrder(true);
    try {
      await api('/api/photos/reorder', { method: 'POST', json: { ids: reorder } });
      setPhotos((cur) => {
        const map = new Map((cur ?? []).map((p) => [p.id, p]));
        return reorder.map((id, order) => ({ ...map.get(id)!, order }));
      });
      setReorder(null);
      showToast('Photo order saved', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save order', 'error');
    } finally {
      setSavingOrder(false);
    }
  }

  async function setAlbumPrivacy(album: AlbumSummary, isPrivate: boolean) {
    try {
      await api(`/api/albums/${album.id}`, { method: 'PATCH', json: { isPrivate } });
      setData((d) => d && { ...d, albums: d.albums.map((a) => (a.id === album.id ? { ...a, isPrivate } : a)) });
      setPhotos((cur) => (cur ?? []).map((p) => (p.albumId === album.id ? { ...p, isPrivate } : p)));
      showToast(isPrivate ? 'Album is now private — share it with people you choose' : 'Album is now visible to all members', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not change privacy', 'error');
    }
  }

  async function confirmDeleteAlbum() {
    if (!deleteAlbum) return;
    const id = deleteAlbum.id;
    try {
      await api(`/api/albums/${id}`, { method: 'DELETE' });
      setPhotos((cur) => (cur ?? []).map((p) => (p.albumId === id ? { ...p, albumId: null } : p)));
      setData((d) => d && { ...d, albums: d.albums.filter((a) => a.id !== id) });
      if (openAlbumId === id) setOpenAlbumId(null);
      setDeleteAlbum(null);
      showToast('Album deleted — its photos are still in All photos', 'info');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete album', 'error');
    }
  }

  function openAlbumDetail(id: string | null) {
    setOpenAlbumId(id);
    setReorder(null);
    router.replace(id ? `/gallery?tab=albums&album=${id}` : '/gallery?tab=albums', { scroll: false });
  }

  // ── Drag & drop (desktop) ─────────────────────────────────────────────
  const dropProps = {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } },
    onDragLeave: (e: React.DragEvent) => { if (e.currentTarget === e.target) setDragging(false); },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setDragging(false);
      uploads.add(e.dataTransfer.files, tab === 'albums' && openAlbumId ? { albumId: openAlbumId } : {});
    },
  };

  const counts = {
    all: photos?.length ?? 0,
    public: photos?.filter((p) => !p.isPrivate).length ?? 0,
    private: photos?.filter((p) => p.isPrivate).length ?? 0,
    unsorted: photos?.filter((p) => !p.albumId).length ?? 0,
  };
  const pending = data?.pendingRequests ?? 0;
  // "Your most liked photo" highlight (only once it has at least one like).
  const mostLikedId = useMemo(() => {
    let best: GalleryPhoto | null = null;
    for (const p of photos ?? []) if ((p.likeCount ?? 0) > 0 && (!best || (p.likeCount ?? 0) > (best.likeCount ?? 0))) best = p;
    return best?.id ?? null;
  }, [photos]);
  const loading = photos === null || data === null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8" {...dropProps}>
      <input ref={fileRef} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFiles(e.target.files)} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="eyebrow text-[#FF4D6D] mb-1">Your photos</p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white">Gallery &amp; albums</h1>
          <p className="text-white/60 text-sm mt-1">Upload photos, choose your main photo and keep private albums for the people you trust.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/gallery/explore" className={btnGhost}><Compass size={15} aria-hidden="true" /> Explore</Link>
          <button type="button" onClick={() => pickFiles(tab === 'albums' && openAlbumId ? openAlbumId : null)} className={btnPrimary}>
            <Upload size={15} aria-hidden="true" /> Upload photos
          </button>
        </div>
      </div>

      <ExploreCard photos={photos} onOpenPhoto={(id) => { setFilter('all'); if (tab !== 'photos') setTab('photos'); setSheetId(id); }} />

      {/* Tabs */}
      <div role="tablist" aria-label="Gallery sections" className="flex gap-1 p-1 glass rounded-2xl mb-5">
        {([
          ['photos', 'All photos', 'Photos', Images, counts.all],
          ['albums', 'Albums', 'Albums', FolderOpen, albums.length],
          ['shared', 'Shared with me', 'Shared', Users, data?.sharedWithMe.length ?? 0],
        ] as const).map(([key, label, short, Icon, n]) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            aria-label={`${label}${loading ? '' : ` (${n})`}${key === 'albums' && pending > 0 ? `, ${pending} pending request${pending === 1 ? '' : 's'}` : ''}`}
            onClick={() => setTab(key)}
            className={`relative flex-1 min-w-fit flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === key ? 'bg-[#DC143C] text-white shadow-lg shadow-[#DC143C]/25' : 'text-white/65 hover:text-white hover:bg-white/5'}`}
          >
            <Icon size={15} aria-hidden="true" className="shrink-0" />
            <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
            {!loading && <span className={`text-xs ${tab === key ? 'text-white/80' : 'text-white/40'}`}>{n}</span>}
            {key === 'albums' && pending > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4AF37] text-[#0A0A0F] text-[10px] font-bold flex items-center justify-center" aria-hidden="true">{pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Upload progress */}
      {uploads.items.length > 0 && (
        <section aria-label="Uploads" className="glass rounded-2xl p-3 mb-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-white/80 text-sm font-medium" aria-live="polite">
              {uploads.busy
                ? `Uploading ${uploads.items.filter((i) => i.status === 'uploading' || i.status === 'queued').length} photo(s)…`
                : `${uploads.items.filter((i) => i.status === 'done').length} uploaded${uploads.items.some((i) => i.status === 'error') ? ', some failed' : ''}`}
            </p>
            {!uploads.busy && <button type="button" onClick={() => uploads.dismiss()} className="text-xs text-white/55 hover:text-white">Clear</button>}
          </div>
          <ul className="space-y-1.5">
            {uploads.items.map((i) => (
              <li key={i.key} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-2 py-1.5">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.preview && i.status !== 'error' ? <img src={i.preview} alt="" className="w-full h-full object-cover" /> : <Images size={16} className="text-white/30" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white/85 text-xs truncate">{i.name}</p>
                  {i.status === 'error' ? (
                    <p className="text-red-300 text-xs flex items-start gap-1"><AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{i.error}</p>
                  ) : (
                    <div className="h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden" role="progressbar" aria-label={`Uploading ${i.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(i.progress * 100)}>
                      <div className={`h-full rounded-full transition-all ${i.status === 'done' ? 'bg-emerald-400' : 'bg-gradient-to-r from-[#DC143C] to-[#FF4D6D]'}`} style={{ width: `${Math.round(i.progress * 100)}%` }} />
                    </div>
                  )}
                </div>
                {i.status === 'done' ? <Check size={16} className="text-emerald-400 shrink-0" aria-label="Uploaded" />
                  : i.status === 'error' ? <button type="button" onClick={() => uploads.dismiss(i.key)} aria-label={`Dismiss ${i.name}`} className="p-1 text-white/50 hover:text-white"><X size={14} /></button>
                  : <Spinner size={14} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loadError && (
        <p role="alert" className="glass-crimson rounded-xl px-4 py-3 text-sm text-white/85 mb-5">{loadError}</p>
      )}

      {/* ── All photos ─────────────────────────────────────────────── */}
      {tab === 'photos' && (
        <section id="panel-photos" role="tabpanel" aria-labelledby="tab-photos">
          {loading ? <GridSkeleton /> : photos!.length === 0 ? (
            <DropZone onPick={() => pickFiles(null)} dragging={dragging} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                {reorder ? (
                  <p className="text-white/70 text-sm">Use the arrows to move photos. Your first public photos show first on your profile.</p>
                ) : (
                  <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1" role="group" aria-label="Filter photos">
                    {([['all', 'All'], ['public', 'Visible'], ['private', 'Private'], ['unsorted', 'Not in an album']] as const).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={filter === k}
                        onClick={() => setFilter(k)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filter === k ? 'bg-white text-[#0A0A0F] border-white' : 'border-white/15 text-white/70 hover:text-white hover:border-white/30'}`}
                      >
                        {label} <span className="opacity-60">{counts[k]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {reorder ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setReorder(null)} className={btnGhost}>Cancel</button>
                    <button type="button" onClick={saveOrder} disabled={savingOrder} className={btnPrimary}>{savingOrder ? <Spinner /> : <Check size={15} aria-hidden="true" />} Save order</button>
                  </div>
                ) : photos!.length > 1 && (
                  <button type="button" onClick={() => { setFilter('all'); setReorder(photos!.map((p) => p.id)); }} className="inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white px-2 py-1.5">
                    <ArrowUpDown size={14} aria-hidden="true" /> Reorder
                  </button>
                )}
              </div>

              {reorder && orderedForReorder ? (
                <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2" aria-label="Reorder photos">
                  {orderedForReorder.map((p, i) => (
                    <li key={p.id}>
                      <PhotoTile photo={p}>
                        <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
                        <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                          <button type="button" onClick={() => move(p.id, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className="p-1.5 rounded-full bg-black/70 text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                          <button type="button" onClick={() => move(p.id, 1)} disabled={i === orderedForReorder.length - 1} aria-label={`Move photo ${i + 1} later`} className="p-1.5 rounded-full bg-black/70 text-white disabled:opacity-30"><ChevronRight size={14} /></button>
                        </div>
                      </PhotoTile>
                    </li>
                  ))}
                </ul>
              ) : visiblePhotos.length === 0 ? (
                <p className="text-white/55 text-sm text-center py-14">No photos here yet.</p>
              ) : (
                <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
                  {visiblePhotos.map((p) => (
                    <li key={p.id}>
                      <PhotoTile photo={p} albumName={p.albumId ? albumById.get(p.albumId)?.name : null} onClick={() => setSheetId(p.id)} showLikes mostLiked={p.id === mostLikedId} />
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={() => pickFiles(null)} className="w-full aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-[#DC143C]/60 hover:bg-[#DC143C]/5 text-white/50 hover:text-white flex flex-col items-center justify-center gap-1 transition-colors">
                      <Plus size={22} aria-hidden="true" /><span className="text-xs">Add photos</span>
                    </button>
                  </li>
                </ul>
              )}
              <p className="text-white/40 text-xs mt-4 hidden sm:block">Tip: drag photos from your computer anywhere on this page to upload.</p>
            </>
          )}
        </section>
      )}

      {/* ── Albums ─────────────────────────────────────────────────── */}
      {tab === 'albums' && (
        <section id="panel-albums" role="tabpanel" aria-labelledby="tab-albums">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/3] rounded-2xl skeleton" />)}
            </div>
          ) : openAlbum ? (
            <div>
              <button type="button" onClick={() => openAlbumDetail(null)} className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white mb-3">
                <ArrowLeft size={15} aria-hidden="true" /> All albums
              </button>
              <div className="glass rounded-2xl p-4 sm:p-5 mb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-white text-xl font-semibold flex items-center gap-2 break-words">
                      {openAlbum.isPrivate ? <Lock size={17} className="text-[#D4AF37] shrink-0" aria-hidden="true" /> : <Globe size={17} className="text-white/50 shrink-0" aria-hidden="true" />}
                      {openAlbum.name}
                    </h2>
                    {openAlbum.description && <p className="text-white/60 text-sm mt-1">{openAlbum.description}</p>}
                    <p className="text-white/45 text-xs mt-1">
                      {openAlbum.photoCount} photo{openAlbum.photoCount === 1 ? '' : 's'}
                      {openAlbum.isPrivate && ` · shared with ${openAlbum.grantedCount ?? 0}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setAlbumDialog({ mode: 'edit', album: openAlbum })} aria-label="Rename album" className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10"><Pencil size={16} /></button>
                    <button type="button" onClick={() => setDeleteAlbum(openAlbum)} aria-label="Delete album" className="p-2 rounded-lg text-white/60 hover:text-red-300 hover:bg-red-500/10"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-3 glass rounded-xl px-3 py-2 cursor-pointer">
                    <Switch checked={openAlbum.isPrivate} label="Private album" onChange={(v) => setAlbumPrivacy(openAlbum, v)} />
                    <span className="text-sm text-white/85">{openAlbum.isPrivate ? 'Private — only people you share with' : 'Visible to all members'}</span>
                  </label>
                  {openAlbum.isPrivate && (
                    <button type="button" onClick={() => setShareOpen(true)} className={`${btnPrimary} relative`}>
                      <Share2 size={15} aria-hidden="true" /> Share
                      {(openAlbum.pendingCount ?? 0) > 0 && (
                        <span className="ml-1 rounded-full bg-[#D4AF37] text-[#0A0A0F] text-[10px] font-bold px-1.5 py-0.5">{openAlbum.pendingCount} request{openAlbum.pendingCount === 1 ? '' : 's'}</span>
                      )}
                    </button>
                  )}
                  <button type="button" onClick={() => setPickerFor(openAlbum)} className={btnGhost}><Plus size={15} aria-hidden="true" /> Add photos</button>
                  <button type="button" onClick={() => pickFiles(openAlbum.id)} className={btnGhost}><Upload size={15} aria-hidden="true" /> Upload here</button>
                </div>
              </div>
              {visiblePhotos.length === 0 ? (
                <EmptyState compact icon={Images} title="This album is empty" description="Add photos you’ve already uploaded, or upload new ones straight into this album." />
              ) : (
                <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
                  {visiblePhotos.map((p) => (
                    <li key={p.id}>
                      <PhotoTile photo={p} onClick={() => setSheetId(p.id)} selected={openAlbum.coverPhotoId === p.id} showLikes mostLiked={p.id === mostLikedId}>
                        {openAlbum.coverPhotoId === p.id && <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded-md pointer-events-none">Cover</span>}
                      </PhotoTile>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-white/60 text-sm">Private albums are hidden until you share them. Members see them as locked and can ask you for access.</p>
                <button type="button" onClick={() => setAlbumDialog({ mode: 'create' })} className={`${btnPrimary} shrink-0`}><FolderPlus size={15} aria-hidden="true" /> <span className="hidden sm:inline">New album</span><span className="sm:hidden">New</span></button>
              </div>
              {albums.length === 0 ? (
                <EmptyState compact icon={FolderOpen} title="No albums yet" description="Group your photos into albums. Make one private and share it with someone special." />
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {albums.map((a) => (
                    <li key={a.id}>
                      <AlbumCard album={a} onOpen={() => openAlbumDetail(a.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Shared with me ─────────────────────────────────────────── */}
      {tab === 'shared' && (
        <section id="panel-shared" role="tabpanel" aria-labelledby="tab-shared">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-hidden="true">
              {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] rounded-2xl skeleton" />)}
            </div>
          ) : data!.sharedWithMe.length === 0 ? (
            <EmptyState compact icon={Lock} title="Nothing shared with you yet" description="When someone shares a private album with you, it shows up here. You can also ask for access from a member’s profile." action={{ label: 'Browse members', href: '/members' }} />
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {data!.sharedWithMe.map((a) => (
                <li key={a.id}>
                  <AlbumCard album={a} owner={a.owner} onOpen={() => setViewSharedId(a.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Link href="/gallery/explore" className="sm:hidden mt-8 flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white">
        <Compass size={15} aria-hidden="true" /> Explore photos from other members
      </Link>

      {dragging && (
        <div className="fixed inset-0 z-[90] bg-[#0A0A0F]/85 backdrop-blur-sm flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="border-2 border-dashed border-[#DC143C] rounded-3xl px-10 py-12 text-center">
            <Upload size={36} className="text-[#FF4D6D] mx-auto mb-3" />
            <p className="text-white font-semibold">Drop photos to upload{openAlbum && tab === 'albums' ? ` to “${openAlbum.name}”` : ''}</p>
          </div>
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────── */}
      <PhotoSheet
        photo={sheetPhoto}
        albums={albums}
        albumContext={tab === 'albums' ? openAlbum : null}
        onClose={() => setSheetId(null)}
        onUpdated={onPhotoUpdated}
        onDeleted={onPhotoDeleted}
        onShowLikers={(id) => { setSheetId(null); setLikersFor(id); }}
        isMostLiked={!!sheetPhoto && sheetPhoto.id === mostLikedId}
        onCoverSet={(albumId, photoId) => setData((d) => d && { ...d, albums: d.albums.map((a) => (a.id === albumId ? { ...a, coverPhotoId: photoId, coverUrl: photos?.find((p) => p.id === photoId)?.thumbnailUrl ?? a.coverUrl } : a)) })}
        onPrev={sheetIndex > 0 ? () => setSheetId(sheetList[sheetIndex - 1].id) : undefined}
        onNext={sheetIndex >= 0 && sheetIndex < sheetList.length - 1 ? () => setSheetId(sheetList[sheetIndex + 1].id) : undefined}
      />

      {openAlbum && (
        <ShareAlbumDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          album={openAlbum}
          onChanged={({ granted, pending: p }) => setData((d) => d && {
            ...d,
            albums: d.albums.map((a) => (a.id === openAlbum.id ? { ...a, grantedCount: granted, pendingCount: p } : a)),
            pendingRequests: d.albums.reduce((n, a) => n + (a.id === openAlbum.id ? p : a.pendingCount ?? 0), 0),
          })}
        />
      )}

      <LikersSheet photoId={likersFor} onClose={() => setLikersFor(null)} />

      <AlbumViewer
        albumId={viewSharedId}
        onClose={() => { setViewSharedId(null); if (search.get('album')) router.replace('/gallery?tab=shared', { scroll: false }); }}
        onLeft={(id) => setData((d) => d && { ...d, sharedWithMe: d.sharedWithMe.filter((a) => a.id !== id) })}
      />

      <AlbumFormDialog
        state={albumDialog}
        onClose={() => setAlbumDialog(null)}
        onSaved={(album, created) => {
          if (created) {
            setData((d) => d && { ...d, albums: [...d.albums, album] });
            setTabState('albums');
            openAlbumDetail(album.id);
          } else {
            setData((d) => d && { ...d, albums: d.albums.map((a) => (a.id === album.id ? { ...a, ...album } : a)) });
          }
        }}
      />

      <PhotoPicker
        album={pickerFor}
        photos={photos ?? []}
        onClose={() => setPickerFor(null)}
        onAdded={(ids, album) => {
          setPhotos((cur) => (cur ?? []).map((p) => (ids.includes(p.id) ? { ...p, albumId: album.id, isPrivate: album.isPrivate } : p)));
          bumpCounts();
        }}
      />

      <Modal
        open={!!deleteAlbum}
        onClose={() => setDeleteAlbum(null)}
        title={`Delete “${deleteAlbum?.name ?? ''}”?`}
        description="The album and its sharing list are removed. Your photos are not deleted — they move to All photos and keep their current privacy."
        footer={<>
          <button type="button" onClick={() => setDeleteAlbum(null)} className={btnGhost}>Cancel</button>
          <button type="button" onClick={confirmDeleteAlbum} className={btnDanger}><Trash2 size={15} aria-hidden="true" /> Delete album</button>
        </>}
      >
        <span className="sr-only">Confirm album deletion</span>
      </Modal>
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────────────── */

function DropZone({ onPick, dragging }: { onPick: () => void; dragging: boolean }) {
  return (
    <div className={`rounded-3xl border-2 border-dashed ${dragging ? 'border-[#DC143C] bg-[#DC143C]/5' : 'border-white/15'} transition-colors`}>
      <EmptyState icon={Images} title="Add your first photos" description="Members with photos get far more likes. Your first visible photo becomes your main profile photo — you can change it any time." />
      <div className="flex flex-col items-center gap-2 -mt-4 pb-10 px-4 text-center">
        <button type="button" onClick={onPick} className={btnPrimary}><Upload size={15} aria-hidden="true" /> Choose photos</button>
        <p className="text-white/40 text-xs">JPG, PNG, WebP or HEIC · up to 10MB each<span className="hidden sm:inline"> · or drag &amp; drop here</span></p>
        <p className="text-white/40 text-xs">Location and camera details are removed from every photo.</p>
      </div>
    </div>
  );
}

function AlbumCard({ album, onOpen, owner }: { album: AlbumSummary; onOpen: () => void; owner?: SharedAlbum['owner'] }) {
  return (
    <button type="button" onClick={onOpen} className="group w-full text-left focus-visible:outline-none" aria-label={`Open album ${album.name}, ${album.photoCount} photos${album.isPrivate ? ', private' : ''}`}>
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-white/25 group-focus-visible:ring-2 group-focus-visible:ring-[#D4AF37] transition-colors">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.coverUrl} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent"><Images size={28} className="text-white/20" aria-hidden="true" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        {album.isPrivate && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 text-[#D4AF37] text-[10px] font-semibold px-2 py-0.5 rounded-full"><Lock size={9} aria-hidden="true" /> Private</span>
        )}
        {(album.pendingCount ?? 0) > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-[#D4AF37] text-[#0A0A0F] text-[10px] font-bold px-2 py-0.5 rounded-full"><Clock size={9} aria-hidden="true" /> {album.pendingCount}</span>
        )}
        <span className="absolute bottom-2 right-2 text-[11px] text-white/90 bg-black/50 px-1.5 py-0.5 rounded-md">{album.photoCount}</span>
      </div>
      <div className="mt-2 min-w-0 flex items-center gap-2">
        {owner && <Avatar url={owner.avatarUrl} name={owner.displayName} size={22} />}
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{album.name}</p>
          <p className="text-white/45 text-xs truncate">
            {owner ? `by ${owner.displayName}` : album.isPrivate ? `Shared with ${album.grantedCount ?? 0}` : 'Visible to members'}
          </p>
        </div>
      </div>
    </button>
  );
}

function AlbumFormDialog({ state, onClose, onSaved }: {
  state: { mode: 'create' } | { mode: 'edit'; album: AlbumSummary } | null;
  onClose: () => void;
  onSaved: (album: AlbumSummary, created: boolean) => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) return;
    setError('');
    if (state.mode === 'edit') { setName(state.album.name); setDescription(state.album.description ?? ''); setIsPrivate(state.album.isPrivate); }
    else { setName(''); setDescription(''); setIsPrivate(true); }
  }, [state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      if (state.mode === 'create') {
        const d = await api<{ album: AlbumSummary }>('/api/albums', { method: 'POST', json: { name, description, isPrivate } });
        onSaved(d.album, true);
        showToast('Album created', 'success');
      } else {
        await api(`/api/albums/${state.album.id}`, { method: 'PATCH', json: { name, description } });
        onSaved({ ...state.album, name: name.trim(), description: description.trim() || null }, false);
        showToast('Album updated', 'success');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!state} onClose={onClose} title={state?.mode === 'edit' ? 'Edit album' : 'New album'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="album-name" className="block text-white/70 text-xs font-medium mb-1.5">Name</label>
          <input id="album-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="e.g. Weekend away" className="input-dark w-full" />
        </div>
        <div>
          <label htmlFor="album-desc" className="block text-white/70 text-xs font-medium mb-1.5">Description <span className="text-white/40">(optional)</span></label>
          <textarea id="album-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 300))} rows={2} className="input-dark w-full resize-none" />
        </div>
        {state?.mode === 'create' && (
          <label className="flex items-center justify-between gap-3 glass rounded-xl px-3.5 py-3 cursor-pointer">
            <span>
              <span className="block text-white text-sm font-medium">Private album</span>
              <span className="block text-white/50 text-xs">Only people you share it with can see the photos.</span>
            </span>
            <Switch checked={isPrivate} onChange={setIsPrivate} label="Private album" />
          </label>
        )}
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>{busy && <Spinner />}{state?.mode === 'edit' ? 'Save' : 'Create album'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PhotoPicker({ album, photos, onClose, onAdded }: {
  album: AlbumSummary | null;
  photos: GalleryPhoto[];
  onClose: () => void;
  onAdded: (ids: string[], album: AlbumSummary) => void;
}) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSelected(new Set()); }, [album?.id]);
  if (!album) return null;
  const candidates = photos.filter((p) => p.albumId !== album.id);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function add() {
    if (!album || selected.size === 0) return;
    setBusy(true);
    try {
      const ids = [...selected];
      await api(`/api/albums/${album.id}/photos`, { method: 'POST', json: { photoIds: ids } });
      onAdded(ids, album);
      showToast(`Added ${ids.length} photo${ids.length === 1 ? '' : 's'} to “${album.name}”`, 'success');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add photos', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Add photos to “${album.name}”`}
      description={album.isPrivate ? 'Photos you add become private and are only visible to people you share this album with.' : 'Photos you add will be visible to members.'}
      footer={<>
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        <button type="button" onClick={add} disabled={busy || selected.size === 0} className={btnPrimary}>{busy ? <Spinner /> : <Plus size={15} aria-hidden="true" />} Add {selected.size || ''}</button>
      </>}
    >
      {candidates.length === 0 ? (
        <p className="text-white/55 text-sm text-center py-10">All your photos are already in this album.</p>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {candidates.map((p) => {
            const blocked = album.isPrivate && p.isProfile;
            const on = selected.has(p.id);
            return (
              <li key={p.id} className={blocked ? 'opacity-40' : ''}>
                <PhotoTile photo={p} selected={on}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    aria-label={blocked ? 'Main photo — can’t be made private' : `${on ? 'Deselect' : 'Select'} photo`}
                    className="absolute inset-0 rounded-xl"
                  />
                  <span aria-hidden="true" className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center pointer-events-none ${on ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-white/80 bg-black/30'}`}>
                    {on && <Check size={12} className="text-[#0A0A0F]" />}
                  </span>
                </PhotoTile>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
