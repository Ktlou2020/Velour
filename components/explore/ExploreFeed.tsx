'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Flame, Trophy, Crown, Sparkles, MapPin, BadgeCheck, ShieldCheck, Images, ArrowLeft, RotateCcw, SlidersHorizontal } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import LikersSheet from '@/components/gallery/LikersSheet';
import { useToast } from '@/lib/toast-context';
import ExploreStyles from './ExploreStyles';
import ExploreTile from './ExploreTile';
import TopStrip from './TopStrip';
import ProtectionNote from '@/components/gallery/ProtectionNote';
import PhotoViewer from './PhotoViewer';
import ReportPhotoDialog from './ReportPhotoDialog';
import { distribute, tileRatio, useColumns } from './useColumns';
import { withLike, type CoupleTypeFilter, type ExplorePhoto, type ExploreSort, type ExploreWho, type FeedQuery, type FeedResponse, type LikeState } from './types';

const SORTS: { key: ExploreSort; label: string; short: string; icon: typeof Flame; hint: string }[] = [
  { key: 'trending', label: 'Trending', short: 'Trending', icon: Flame, hint: 'Hot right now — recent likes count most' },
  { key: 'week', label: 'Top this week', short: 'Week', icon: Trophy, hint: 'Most liked since Monday' },
  { key: 'all', label: 'All time', short: 'All time', icon: Crown, hint: 'The most liked photos ever' },
  { key: 'new', label: 'New', short: 'New', icon: Sparkles, hint: 'Freshly posted' },
];
const WHO: { key: ExploreWho; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'nonbinary', label: 'Non-binary' },
  { key: 'couples', label: 'Couples' },
];
const COUPLE_TYPES: { key: CoupleTypeFilter | null; label: string }[] = [
  { key: null, label: 'All couples' },
  { key: 'MF', label: 'Woman & man' },
  { key: 'FF', label: 'Two women' },
  { key: 'MM', label: 'Two men' },
  { key: 'MX', label: 'With a non-binary partner' },
];

function queryFrom(sp: URLSearchParams): FeedQuery {
  const sort = SORTS.some((s) => s.key === sp.get('sort')) ? (sp.get('sort') as ExploreSort) : 'trending';
  const who = WHO.some((w) => w.key === sp.get('who')) ? (sp.get('who') as ExploreWho) : 'everyone';
  const ct = sp.get('coupleType');
  const coupleType = who === 'couples' && ['MF', 'FF', 'MM', 'MX'].includes(ct ?? '') ? (ct as CoupleTypeFilter) : null;
  return { sort, who, coupleType, near: sp.get('near') === '1', verified: sp.get('verified') === '1' };
}

function qs(q: FeedQuery, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (q.sort !== 'trending') p.set('sort', q.sort);
  if (q.who !== 'everyone') p.set('who', q.who);
  if (q.coupleType) p.set('coupleType', q.coupleType);
  if (q.near) p.set('near', '1');
  if (q.verified) p.set('verified', '1');
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

type ViewerCtx = { list: 'feed' | 'top' | 'single'; id: string } | null;

export default function ExploreFeed() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const cols = useColumns();

  const [query, setQuery] = useState<FeedQuery>(() => queryFrom(new URLSearchParams(search.toString())));
  const [photos, setPhotos] = useState<ExplorePhoto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [needsLocation, setNeedsLocation] = useState(false);
  const [top, setTop] = useState<ExplorePhoto[] | null>(null);
  const [topPeriod, setTopPeriod] = useState<'week' | 'rolling'>('week');
  const [me, setMe] = useState<{ username: string; hasLocation: boolean } | null>(null);
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [viewer, setViewer] = useState<ViewerCtx>(null);
  const [single, setSingle] = useState<ExplorePhoto | null>(null);
  const [reporting, setReporting] = useState<ExplorePhoto | null>(null);
  const [likersFor, setLikersFor] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const q = queryFrom(new URLSearchParams(search.toString()));
    return q.who !== 'everyone' || q.near || q.verified;
  });

  const reqId = useRef(0);
  const loadingRef = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const likeSeq = useRef<Record<string, number>>({});
  const topLoaded = useRef(false);

  const watermark = me?.username ?? (session?.user as { username?: string } | undefined)?.username ?? 'unbound';

  // ── Loading ────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (q: FeedQuery, after: string | null) => {
    const id = ++reqId.current;
    loadingRef.current = true;
    if (after) setLoadingMore(true);
    setError('');
    try {
      const wantTop = !after && !topLoaded.current;
      const res = await fetch(`/api/gallery?${qs(q, { ...(after ? { cursor: after } : {}), ...(wantTop ? { top: '1' } : {}) })}`);
      const d = await res.json().catch(() => ({})) as FeedResponse & { error?: string };
      if (id !== reqId.current) return;
      if (!res.ok) throw new Error(d.error || 'Could not load Explore');
      setPhotos((cur) => {
        if (!after) return d.photos;
        const seen = new Set((cur ?? []).map((p) => p.id));
        return [...(cur ?? []), ...d.photos.filter((p) => !seen.has(p.id))];
      });
      setCursor(d.nextCursor);
      setNeedsLocation(d.needsLocation);
      setMe(d.viewer);
      if (wantTop && d.top) { topLoaded.current = true; setTop(d.top); setTopPeriod(d.topPeriod ?? 'week'); }
      else if (wantTop) setTop([]);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : 'Could not load Explore');
      setPhotos((cur) => cur ?? []);
    } finally {
      if (id === reqId.current) { loadingRef.current = false; setLoadingMore(false); }
    }
  }, []);

  useEffect(() => {
    setPhotos(null);
    setCursor(null);
    fetchPage(query, null);
  }, [query, fetchPage]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingRef.current) return;
    fetchPage(query, cursor);
  }, [cursor, query, fetchPage]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore, photos?.length]);

  // Deep link: ?photo=<id> (e.g. from a "liked your photo" notification).
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    const id = search.get('photo');
    if (!id) return;
    deepLinked.current = true;
    fetch(`/api/gallery/photo/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.photo) throw new Error(d.error || 'This photo is no longer available');
        setSingle(d.photo);
        setViewer({ list: 'single', id: d.photo.id });
      })
      .catch((e) => { showToast(e instanceof Error ? e.message : 'This photo is no longer available', 'info'); syncUrl(query, null); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncUrl(q: FeedQuery, photoId: string | null) {
    const s = qs(q, photoId ? { photo: photoId } : {});
    window.history.replaceState(null, '', s ? `/gallery/explore?${s}` : '/gallery/explore');
  }

  function update(patch: Partial<FeedQuery>) {
    const q = { ...query, ...patch };
    if (q.who !== 'couples') q.coupleType = null;
    setQuery(q);
    router.replace(qs(q) ? `/gallery/explore?${qs(q)}` : '/gallery/explore', { scroll: false });
  }

  // ── Likes (optimistic, last-write-wins per photo) ─────────────────────
  const likesRef = useRef(likes);
  likesRef.current = likes;
  const onLike = useCallback(async (photo: ExplorePhoto, desired: boolean) => {
    if (photo.isOwn) return;
    const cur = likesRef.current[photo.id] ?? { liked: photo.liked, count: photo.likeCount };
    if (cur.liked === desired) return;
    const optimistic = { liked: desired, count: Math.max(0, cur.count + (desired ? 1 : -1)) };
    const seq = (likeSeq.current[photo.id] ?? 0) + 1;
    likeSeq.current[photo.id] = seq;
    setLikes((m) => ({ ...m, [photo.id]: optimistic }));
    try {
      const res = await fetch(`/api/photos/${photo.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ like: desired }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save your like');
      if (likeSeq.current[photo.id] === seq) setLikes((m) => ({ ...m, [photo.id]: { liked: d.liked, count: d.likeCount } }));
    } catch (e) {
      if (likeSeq.current[photo.id] === seq) setLikes((m) => ({ ...m, [photo.id]: cur }));
      showToast(e instanceof Error ? e.message : 'Could not save your like', 'error');
    }
  }, [showToast]);

  // ── Derived lists ─────────────────────────────────────────────────────
  const feed = useMemo(() => (photos ?? []).map((p) => withLike(p, likes)), [photos, likes]);
  const topList = useMemo(() => (top ? top.map((p) => withLike(p, likes)) : null), [top, likes]);
  const columns = useMemo(() => distribute(feed, cols), [feed, cols]);

  const viewerList = viewer?.list === 'top' ? topList ?? [] : viewer?.list === 'single' ? (single ? [withLike(single, likes)] : []) : feed;
  const viewerIndex = viewer ? viewerList.findIndex((p) => p.id === viewer.id) : -1;

  const openFeed = useCallback((p: ExplorePhoto) => { setViewer({ list: 'feed', id: p.id }); syncUrl(query, p.id); }, [query]);
  const openTop = useCallback((p: ExplorePhoto) => { setViewer({ list: 'top', id: p.id }); syncUrl(query, p.id); }, [query]);
  const closeViewer = useCallback(() => { setViewer(null); syncUrl(query, null); }, [query]);
  const onIndex = useCallback((i: number) => {
    const p = viewerList[i];
    if (p) { setViewer((v) => v && { ...v, id: p.id }); syncUrl(query, p.id); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerList, query]);
  const showLikers = useCallback((p: ExplorePhoto) => setLikersFor(p.id), []);

  const filtered = query.who !== 'everyone' || query.near || query.verified;
  const sortMeta = SORTS.find((s) => s.key === query.sort)!;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-12">
      <ExploreStyles />

      {/* Header */}
      <header className="pt-6 sm:pt-8 pb-4">
        <Link href="/gallery" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white mb-3">
          <ArrowLeft size={15} aria-hidden="true" /> My gallery
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-[#FF4D6D] mb-1">Community</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">Explore</h1>
            <p className="text-white/60 text-sm mt-1 max-w-xl">Discover photos members have shared. Double-tap to like — the most loved rise to the top.</p>
          </div>
        </div>
        <p className="mt-3 inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65">
          <ShieldCheck size={14} className="mt-px shrink-0 text-emerald-400" aria-hidden="true" />
          <span>Only photos members chose to make public appear here. Private albums never do. <Link href="/gallery#explore-settings" className="text-[#D4AF37] hover:underline whitespace-nowrap">Your Explore settings</Link></span>
        </p>
        <ProtectionNote className="mt-3" />
      </header>

      <TopStrip photos={topList} period={topPeriod} watermark={watermark} onOpen={openTop} />

      {/* Sort tabs + filters (sticky under the navbar) */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-white/5 mb-4">
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Rank photos by" className="hush-no-scrollbar flex flex-1 gap-1 overflow-x-auto">
            {SORTS.map(({ key, label, short, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={query.sort === key}
                onClick={() => update({ sort: key })}
                className={`flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3.5 h-9 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors ${query.sort === key ? 'bg-[#DC143C] text-white shadow-lg shadow-[#DC143C]/25' : 'text-white/65 hover:text-white hover:bg-white/5'}`}
              >
                <Icon size={14} aria-hidden="true" className={query.sort === key ? '' : 'hidden sm:block'} />
                <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-label={filtered ? 'Filters (on)' : 'Filters'}
            aria-controls="explore-filters"
            className={`relative flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 sm:px-3 h-9 text-sm transition-colors ${filtersOpen || filtered ? 'border-[#D4AF37]/60 text-[#D4AF37]' : 'border-white/15 text-white/70 hover:text-white'}`}
          >
            <SlidersHorizontal size={14} aria-hidden="true" /> <span className="hidden sm:inline">Filters</span>
            {filtered && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#D4AF37]" aria-hidden="true" />}
          </button>
        </div>

        {filtersOpen && (
          <div id="explore-filters" className="pt-2 space-y-2">
            <div className="hush-no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Show photos from">
              {WHO.map(({ key, label }) => (
                <Chip key={key} on={query.who === key} onClick={() => update({ who: key })}>{label}</Chip>
              ))}
              <span className="mx-1 w-px shrink-0 bg-white/10" aria-hidden="true" />
              <Chip on={query.near} onClick={() => update({ near: !query.near })}><MapPin size={12} aria-hidden="true" /> Near me</Chip>
              <Chip on={query.verified} onClick={() => update({ verified: !query.verified })}><BadgeCheck size={12} aria-hidden="true" /> Verified</Chip>
            </div>
            {query.who === 'couples' && (
              <div className="hush-no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Couple type">
                {COUPLE_TYPES.map(({ key, label }) => (
                  <Chip key={label} small on={query.coupleType === key} onClick={() => update({ coupleType: key })}>{label}</Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">{photos ? `${sortMeta.label}: ${photos.length} photos` : 'Loading photos'}</p>

      {needsLocation && (
        <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <MapPin size={20} className="text-[#D4AF37] shrink-0" aria-hidden="true" />
          <p className="flex-1 min-w-[12rem] text-sm text-white/80">Add your city to your profile to see photos from members within 50 km. Only a rough distance is ever shown.</p>
          <Link href="/profile" className="rounded-xl bg-white text-[#0A0A0F] px-4 py-2 text-sm font-semibold">Set my location</Link>
          <button type="button" onClick={() => update({ near: false })} className="text-sm text-white/60 hover:text-white">Turn off Near me</button>
        </div>
      )}

      {error && photos && photos.length > 0 && (
        <p role="alert" className="glass-crimson rounded-xl px-4 py-3 text-sm text-white/85 mb-4 flex items-center justify-between gap-3">
          {error}
          <button type="button" onClick={() => fetchPage(query, cursor)} className="inline-flex items-center gap-1 text-white font-medium"><RotateCcw size={14} aria-hidden="true" /> Retry</button>
        </p>
      )}

      {/* Grid */}
      {photos === null ? (
        <GridSkeleton cols={cols} />
      ) : photos.length === 0 && !needsLocation ? (
        error ? (
          <div className="py-16 text-center">
            <p className="text-white/70 mb-4">{error}</p>
            <button type="button" onClick={() => fetchPage(query, null)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white"><RotateCcw size={14} aria-hidden="true" /> Try again</button>
          </div>
        ) : filtered ? (
          <EmptyState icon={Images} title="No photos match these filters" description="Try a wider search — or check back soon, new photos are shared every day." action={{ label: 'Clear filters', href: query.sort === 'trending' ? '/gallery/explore' : `/gallery/explore?sort=${query.sort}` }} />
        ) : query.sort === 'week' ? (
          <EmptyState icon={Trophy} title="No likes yet this week" description="The week resets every Monday. Like a photo you love — it could top the chart." action={{ label: 'See what’s trending', href: '/gallery/explore' }} />
        ) : (
          <EmptyState icon={Images} title="Explore is waiting for its first photos" description="Share a public photo from your gallery and be the first to be discovered." action={{ label: 'Go to my gallery', href: '/gallery' }} />
        )
      ) : (
        <>
          <div className="flex gap-2 sm:gap-3 items-start">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-3">
                {col.map(({ item, index }) => (
                  <ExploreTile
                    key={item.id}
                    photo={item}
                    watermark={watermark}
                    eager={index < cols * 2}
                    showRank={query.sort !== 'new'}
                    onOpen={openFeed}
                    onLike={onLike}
                    onShowLikers={showLikers}
                  />
                ))}
              </div>
            ))}
          </div>

          <div ref={sentinel} aria-hidden="true" />
          {loadingMore && <div className="mt-3"><GridSkeleton cols={cols} rows={1} /></div>}
          {!cursor && !loadingMore && photos.length > 0 && (
            <div className="mt-10 text-center">
              <p className="text-white/50 text-sm">You’re all caught up{query.sort === 'trending' ? ' on what’s trending' : ''}.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SORTS.filter((s) => s.key !== query.sort).map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => { update({ sort: key }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75 hover:text-white hover:border-white/30">
                    <Icon size={12} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {viewer && viewerIndex >= 0 && (
        <PhotoViewer
          photos={viewerList}
          index={viewerIndex}
          watermark={watermark}
          hasMore={viewer.list === 'feed' && !!cursor}
          onIndex={onIndex}
          onClose={closeViewer}
          onLike={onLike}
          onNearEnd={loadMore}
          onReport={setReporting}
          onShowLikers={showLikers}
        />
      )}
      <ReportPhotoDialog photo={reporting} onClose={() => setReporting(null)} />
      <LikersSheet photoId={likersFor} onClose={() => setLikersFor(null)} />
    </div>
  );
}

function Chip({ on, onClick, children, small }: { on: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border whitespace-nowrap transition-colors ${small ? 'px-2.5 h-7 text-[11px]' : 'px-3 h-8 text-xs'} font-medium ${on ? 'bg-white text-[#0A0A0F] border-white' : 'border-white/15 text-white/70 hover:text-white hover:border-white/30'}`}
    >
      {children}
    </button>
  );
}

function GridSkeleton({ cols, rows = 3 }: { cols: number; rows?: number }) {
  const ids = Array.from({ length: cols * rows }, (_, i) => `s${i * 7}`);
  const columns = distribute(ids.map((id) => ({ id })), cols);
  return (
    <div className="flex gap-2 sm:gap-3 items-start" aria-hidden="true">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 flex flex-col gap-2 sm:gap-3">
          {col.map(({ item }) => (
            <div key={item.id} className="rounded-2xl overflow-hidden border border-white/[0.06]">
              <div className="skeleton" style={{ aspectRatio: `1 / ${tileRatio(item.id)}` }} />
              <div className="flex items-center gap-2 p-2.5"><div className="h-7 w-7 rounded-full skeleton" /><div className="h-3 flex-1 rounded skeleton" /></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
