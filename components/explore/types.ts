import type { ExplorePhoto, ExploreSort, ExploreWho } from '@/lib/explore';

export type { ExplorePhoto, ExploreSort, ExploreWho };

export type CoupleTypeFilter = 'MF' | 'FF' | 'MM' | 'MX';

export interface FeedQuery {
  sort: ExploreSort;
  who: ExploreWho;
  coupleType: CoupleTypeFilter | null;
  near: boolean;
  verified: boolean;
}

export interface FeedResponse {
  photos: ExplorePhoto[];
  nextCursor: string | null;
  needsLocation: boolean;
  viewer: { username: string; hasLocation: boolean };
  top?: ExplorePhoto[];
  topPeriod?: 'week' | 'rolling';
}

export interface LikeState { liked: boolean; count: number }

/** Photo with the latest optimistic like state applied. */
export function withLike(p: ExplorePhoto, likes: Record<string, LikeState>): ExplorePhoto {
  const s = likes[p.id];
  return s ? { ...p, liked: s.liked, likeCount: s.count } : p;
}

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(n / 1000)}k`;
}

export function posterLine(p: ExplorePhoto): string {
  const dist = p.poster.distance?.replace(/ away$/, '').replace(/^Less than 2 km$/, '< 2 km');
  const bits = [p.poster.age, dist ?? p.poster.city].filter(Boolean);
  return bits.join(' · ');
}
