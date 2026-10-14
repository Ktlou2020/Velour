/**
 * Explore — the community feed of public photos (server only).
 *
 * Eligibility is computed at query time from a single Prisma `where`
 * (`exploreEligibleWhere`), so a photo disappears from Explore the moment it
 * is made private, moved into a private/system album, deleted, its owner
 * snoozes / deactivates / opts out, or either side blocks the other.
 *
 * Ranking tabs
 *   trending  hot score = Σ over likes in the last 7 days of 1 / (1 + h/24)^1.5
 *             (h = hours since the like) + freshness boost (1 − ageH/48) for
 *             photos younger than 48 h. Candidates: every photo with a like in
 *             the last 7 days ∪ the newest 200 photos. Scored in memory.
 *   week      likes created since Monday 00:00 SAST (startOfWeekSAST).
 *   all       Photo.likeCount desc, then createdAt desc.
 *   new       createdAt desc.
 *
 * Pagination is offset-based against a snapshot timestamp (`asOf`) carried in
 * the cursor: photos posted / likes given after the snapshot are ignored, so
 * pages stay stable while the member scrolls.
 */
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { distanceKm, boundingBox, formatDistance } from '@/lib/geo'
import { startOfWeekSAST } from '@/lib/plans'
import { coupleDisplayName, getCoupleMemberNames } from '@/lib/couples'
import { ageFrom, coupleTypeBadge, parseCoupleMembers, type CoupleType } from '@/lib/identity'
import { mediaIdFromUrl, mediaThumbUrl } from '@/lib/media'
import { sendPushToUser } from '@/lib/push'

// ── Constants ───────────────────────────────────────────────────────────────

export const EXPLORE_PAGE_SIZE = 24
export const NEAR_ME_KM = 50
export const HOT_WINDOW_DAYS = 7
export const FRESH_HOURS = 48
const NEWEST_CANDIDATES = 200
const MAX_SCORED_CANDIDATES = 2000
const TOP_STRIP_SIZE = 10

export const EXPLORE_SORTS = ['trending', 'week', 'all', 'new'] as const
export type ExploreSort = typeof EXPLORE_SORTS[number]
export const EXPLORE_WHO = ['everyone', 'women', 'men', 'nonbinary', 'couples'] as const
export type ExploreWho = typeof EXPLORE_WHO[number]
const COUPLE_TYPES: CoupleType[] = ['MF', 'FF', 'MM', 'MX']

export interface ExploreFilters {
  who: ExploreWho
  coupleType: CoupleType | null
  near: boolean
  verified: boolean
}

export interface LatLng { lat: number; lng: number }

const HOUR = 60 * 60 * 1000

// ── Pure helpers (exported for tests / reuse) ───────────────────────────────

/** Weight of one like, `hours` after it was given: 1 / (1 + h/24)^1.5. */
export function likeDecay(hours: number): number {
  return 1 / Math.pow(1 + Math.max(0, hours) / 24, 1.5)
}

/** Small boost so brand-new photos get a chance: 1 at 0 h, fading to 0 at 48 h. */
export function freshnessBoost(ageHours: number): number {
  if (ageHours < 0) return 1
  return ageHours < FRESH_HOURS ? 1 - ageHours / FRESH_HOURS : 0
}

export function parseFilters(sp: URLSearchParams): { sort: ExploreSort; filters: ExploreFilters } {
  const sortRaw = sp.get('sort')
  const whoRaw = sp.get('who')
  const ctRaw = sp.get('coupleType')
  const sort = (EXPLORE_SORTS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as ExploreSort) : 'trending'
  const who = (EXPLORE_WHO as readonly string[]).includes(whoRaw ?? '') ? (whoRaw as ExploreWho) : 'everyone'
  const coupleType = who === 'couples' && COUPLE_TYPES.includes(ctRaw as CoupleType) ? (ctRaw as CoupleType) : null
  return { sort, filters: { who, coupleType, near: sp.get('near') === '1', verified: sp.get('verified') === '1' } }
}

/** Cursor = "<asOf ms>.<offset>". */
export function encodeCursor(asOf: Date, offset: number): string {
  return `${asOf.getTime()}.${offset}`
}
export function decodeCursor(raw: string | null, now = new Date()): { asOf: Date; offset: number } {
  const m = raw ? /^(\d{12,14})\.(\d{1,6})$/.exec(raw) : null
  if (!m) return { asOf: now, offset: 0 }
  const t = Number(m[1])
  // A snapshot from the future or older than a day is not honoured.
  if (t > now.getTime() + 60_000 || t < now.getTime() - 24 * HOUR) return { asOf: now, offset: 0 }
  return { asOf: new Date(t), offset: Math.min(Number(m[2]), 100_000) }
}

/** Thumbnail for one of our media URLs (`?size=thumb`), else the stored thumbnail / url. */
export function thumbFor(url: string, thumbnailUrl?: string | null): string {
  const id = mediaIdFromUrl(url)
  if (id) return mediaThumbUrl(id)
  return thumbnailUrl || url
}

type TravelFields = {
  travelLat?: number | null
  travelLng?: number | null
  travelUntil?: Date | null
  travelCity?: string | null
  membershipTier?: string | null
}
type LocFields = TravelFields & { latitude?: number | null; longitude?: number | null }

function travelActive(p: TravelFields, now: Date): boolean {
  return (
    p.travelLat != null && p.travelLng != null && !!p.travelUntil && p.travelUntil.getTime() > now.getTime() &&
    (p.membershipTier === 'GOLD' || p.membershipTier === 'PLATINUM')
  )
}

/** Where a member "is" for Near me: their active travel location, else home. */
export function effectiveLocation(p: LocFields | null | undefined, now = new Date()): LatLng | null {
  if (!p) return null
  if (travelActive(p, now)) return { lat: p.travelLat!, lng: p.travelLng! }
  if (p.latitude != null && p.longitude != null) return { lat: p.latitude, lng: p.longitude }
  return null
}

// ── Where builders ──────────────────────────────────────────────────────────

/**
 * The single source of truth for "may this photo appear in Explore for this
 * viewer". Own photos are allowed (shown as "You").
 */
export function exploreEligibleWhere(viewerId: string, now = new Date()): Prisma.PhotoWhereInput {
  return {
    isPrivate: false,
    AND: [
      // Not in a private album, not in a hidden system album (chat images, voice notes, video).
      { OR: [{ albumId: null }, { album: { isPrivate: false, NOT: { name: { startsWith: '__' } } } }] },
      // Images only (legacy rows have no mimeType).
      { OR: [{ mimeType: null }, { mimeType: { startsWith: 'image/' } }] },
    ],
    user: {
      isActive: true,
      // No block in either direction with the viewer.
      blocksGiven: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
      profile: {
        is: {
          showInExplore: true,
          // Not snoozed: either not snoozing, or the snooze has an end date that has passed.
          OR: [{ isSnoozed: false }, { snoozedUntil: { lte: now } }],
        },
      },
    },
  }
}

function boxWhere(latKey: 'latitude' | 'travelLat', lngKey: 'longitude' | 'travelLng', b: ReturnType<typeof boundingBox>): Prisma.ProfileWhereInput {
  return { [latKey]: { gte: b.minLat, lte: b.maxLat }, [lngKey]: { gte: b.minLng, lte: b.maxLng } } as Prisma.ProfileWhereInput
}

/** Filters chosen by the viewer, as a Photo where. Hidden genders never match a gender filter. */
export function exploreFilterWhere(f: ExploreFilters, near: LatLng | null, now = new Date()): Prisma.PhotoWhereInput {
  const profile: Prisma.ProfileWhereInput[] = []
  switch (f.who) {
    case 'women': profile.push({ isCouple: false, showGender: true, gender: 'WOMAN' }); break
    case 'men': profile.push({ isCouple: false, showGender: true, gender: 'MAN' }); break
    case 'nonbinary': profile.push({ isCouple: false, showGender: true, gender: { in: ['NON_BINARY', 'OTHER'] } }); break
    case 'couples':
      // A couple type reveals genders, so it only matches couples who show their gender.
      profile.push(f.coupleType ? { isCouple: true, showGender: true, coupleType: f.coupleType } : { isCouple: true })
      break
  }
  if (f.near && near) {
    const b = boundingBox(near.lat, near.lng, NEAR_ME_KM)
    profile.push({
      OR: [
        { ...boxWhere('travelLat', 'travelLng', b), travelUntil: { gt: now }, membershipTier: { in: ['GOLD', 'PLATINUM'] } },
        {
          ...boxWhere('latitude', 'longitude', b),
          OR: [
            { travelUntil: null }, { travelUntil: { lte: now } }, { travelLat: null }, { travelLng: null },
            { membershipTier: 'FREE' },
          ],
        },
      ],
    })
  }
  const user: Prisma.UserWhereInput = {}
  if (f.verified) user.isVerified = true
  if (profile.length) user.profile = { is: { AND: profile } }
  return Object.keys(user).length ? { user } : {}
}

// ── Serialisation ───────────────────────────────────────────────────────────

const posterProfileSelect = {
  displayName: true,
  profilePhoto: true,
  dateOfBirth: true,
  city: true,
  isCouple: true,
  coupleType: true,
  coupleMembers: true,
  showGender: true,
  latitude: true,
  longitude: true,
  travelLat: true,
  travelLng: true,
  travelUntil: true,
  travelCity: true,
  membershipTier: true,
  id: true,
  partner: { select: { id: true, partnerId: true, isCouple: true, displayName: true, dateOfBirth: true, user: { select: { username: true } } } },
} satisfies Prisma.ProfileSelect

export const explorePhotoSelect = {
  id: true,
  url: true,
  thumbnailUrl: true,
  caption: true,
  createdAt: true,
  likeCount: true,
  userId: true,
  user: { select: { id: true, username: true, isVerified: true, profile: { select: posterProfileSelect } } },
} satisfies Prisma.PhotoSelect

export type ExplorePhotoRow = Prisma.PhotoGetPayload<{ select: typeof explorePhotoSelect }>

export interface ExplorePoster {
  username: string
  name: string
  avatarUrl: string | null
  age: string | null
  city: string | null
  travelling: boolean
  distance: string | null
  isVerified: boolean
  isCouple: boolean
  coupleBadge: string | null
}

export interface ExplorePhoto {
  id: string
  url: string
  thumbUrl: string
  caption: string | null
  createdAt: string
  likeCount: number
  liked: boolean
  isOwn: boolean
  isNew: boolean
  trending: boolean
  rank: number | null
  weekLikes?: number
  poster: ExplorePoster
}

export function posterOf(row: ExplorePhotoRow, viewerLoc: LatLng | null, now = new Date()): ExplorePoster {
  const p = row.user.profile
  const baseName = p?.displayName || row.user.username
  let name = baseName
  const ages: number[] = []
  const a1 = ageFrom(p?.dateOfBirth ?? null)
  if (a1 !== undefined) ages.push(a1)
  if (p?.isCouple) {
    const partner = p.partner && p.partner.isCouple && p.partner.partnerId === p.id ? p.partner : null
    if (partner) {
      name = coupleDisplayName([baseName, partner.displayName || partner.user.username]) || baseName
      const a2 = ageFrom(partner.dateOfBirth ?? null)
      if (a2 !== undefined) ages.push(a2)
    } else {
      const names = getCoupleMemberNames(p.coupleMembers)
      if (names.length >= 2) name = coupleDisplayName(names)
      const m2 = parseCoupleMembers(p.coupleMembers)[1]
      const a2 = ageFrom(m2?.dateOfBirth ?? null)
      if (a2 !== undefined) ages.push(a2)
    }
  }
  const travelling = !!p && travelActive(p, now)
  const loc = effectiveLocation(p, now)
  const avatarRaw = p?.profilePhoto || null
  const avatarId = avatarRaw ? mediaIdFromUrl(avatarRaw) : null
  return {
    username: row.user.username,
    name,
    avatarUrl: avatarId ? mediaThumbUrl(avatarId) : avatarRaw,
    age: ages.length ? ages.join(' & ') : null,
    city: (travelling ? p?.travelCity : p?.city) || null,
    travelling,
    // Coarse distance only — exact coordinates never leave the server.
    distance: viewerLoc && loc ? formatDistance(distanceKm(viewerLoc.lat, viewerLoc.lng, loc.lat, loc.lng)) : null,
    isVerified: row.user.isVerified,
    isCouple: !!p?.isCouple,
    coupleBadge: p?.isCouple && p.showGender !== false ? coupleTypeBadge(p.coupleType) ?? null : null,
  }
}

function serialize(
  rows: ExplorePhotoRow[],
  ctx: { viewerId: string; viewerLoc: LatLng | null; likedIds: Set<string>; trendingIds: Set<string>; ranks?: Map<string, number>; weekLikes?: Map<string, number>; now: Date },
): ExplorePhoto[] {
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    thumbUrl: thumbFor(r.url, r.thumbnailUrl),
    caption: r.caption,
    createdAt: r.createdAt.toISOString(),
    likeCount: Math.max(0, r.likeCount),
    liked: ctx.likedIds.has(r.id),
    isOwn: r.userId === ctx.viewerId,
    isNew: ctx.now.getTime() - r.createdAt.getTime() < FRESH_HOURS * HOUR,
    trending: ctx.trendingIds.has(r.id),
    rank: ctx.ranks?.get(r.id) ?? null,
    ...(ctx.weekLikes ? { weekLikes: ctx.weekLikes.get(r.id) ?? 0 } : {}),
    poster: posterOf(r, ctx.viewerLoc, ctx.now),
  }))
}

// ── Viewer context ──────────────────────────────────────────────────────────

export interface ExploreViewer {
  id: string
  username: string
  location: LatLng | null
}

export async function loadViewer(userId: string, now = new Date()): Promise<ExploreViewer | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, isActive: true,
      profile: { select: { latitude: true, longitude: true, travelLat: true, travelLng: true, travelUntil: true, membershipTier: true } },
    },
  })
  if (!u || !u.isActive) return null
  return { id: u.id, username: u.username, location: effectiveLocation(u.profile, now) }
}

// ── Candidate ranking ───────────────────────────────────────────────────────

type Candidate = { id: string; createdAt: Date; likeCount: number; loc: LatLng | null }

const candidateSelect = {
  id: true, createdAt: true, likeCount: true,
  user: { select: { profile: { select: { latitude: true, longitude: true, travelLat: true, travelLng: true, travelUntil: true, membershipTier: true } } } },
} satisfies Prisma.PhotoSelect

function toCandidate(r: Prisma.PhotoGetPayload<{ select: typeof candidateSelect }>, now: Date): Candidate {
  return { id: r.id, createdAt: r.createdAt, likeCount: r.likeCount, loc: effectiveLocation(r.user.profile, now) }
}

/** Exact radius check after the bounding-box prefilter. */
function withinRadius(c: { loc: LatLng | null }, near: LatLng | null): boolean {
  if (!near) return true
  return !!c.loc && distanceKm(near.lat, near.lng, c.loc.lat, c.loc.lng) <= NEAR_ME_KM
}

/** Σ decay per photo for likes in the hot window (one SQL round-trip). */
async function hotScores(asOf: Date): Promise<Map<string, number>> {
  const since = new Date(asOf.getTime() - HOT_WINDOW_DAYS * 24 * HOUR)
  const rows = await db.$queryRaw<{ photoId: string; score: number }[]>`
    SELECT "photoId", SUM(POWER(1 + GREATEST(EXTRACT(EPOCH FROM (${asOf}::timestamp - "createdAt")), 0) / 86400.0, -1.5))::float8 AS score
    FROM "PhotoLike"
    WHERE "createdAt" >= ${since}::timestamp AND "createdAt" <= ${asOf}::timestamp
    GROUP BY "photoId"
    ORDER BY score DESC
    LIMIT ${MAX_SCORED_CANDIDATES}`
  return new Map(rows.map((r) => [r.photoId, Number(r.score)]))
}

/** Likes per photo given in [since, asOf]. */
async function likeCountsSince(since: Date, asOf: Date): Promise<Map<string, number>> {
  const rows = await db.photoLike.groupBy({
    by: ['photoId'],
    where: { createdAt: { gte: since, lte: asOf } },
    _count: { _all: true },
    orderBy: { _count: { photoId: 'desc' } },
    take: MAX_SCORED_CANDIDATES,
  })
  return new Map(rows.map((r) => [r.photoId, r._count._all]))
}

async function eligibleCandidates(where: Prisma.PhotoWhereInput, ids: string[] | null, take?: number): Promise<Candidate[]> {
  if (ids && ids.length === 0) return []
  const now = new Date()
  const rows = await db.photo.findMany({
    where: ids ? { AND: [where, { id: { in: ids } }] } : where,
    select: candidateSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(take ? { take } : {}),
  })
  return rows.map((r) => toCandidate(r, now))
}

export interface RankedId { id: string; score: number; weekLikes?: number; hasLikes: boolean }

/** Full trending order for a where (already including eligibility & filters). */
async function rankTrending(where: Prisma.PhotoWhereInput, asOf: Date, near: LatLng | null): Promise<RankedId[]> {
  const scores = await hotScores(asOf)
  const [scored, newest] = await Promise.all([
    eligibleCandidates(where, Array.from(scores.keys())),
    eligibleCandidates(where, null, NEWEST_CANDIDATES),
  ])
  const byId = new Map<string, Candidate>()
  for (const c of [...scored, ...newest]) byId.set(c.id, c)
  const out: (RankedId & { c: Candidate })[] = []
  for (const c of byId.values()) {
    if (!withinRadius(c, near)) continue
    const likeScore = scores.get(c.id) ?? 0
    const ageH = (asOf.getTime() - c.createdAt.getTime()) / HOUR
    out.push({ id: c.id, score: likeScore + freshnessBoost(ageH), hasLikes: likeScore > 0, c })
  }
  out.sort((a, b) => b.score - a.score || b.c.likeCount - a.c.likeCount || b.c.createdAt.getTime() - a.c.createdAt.getTime() || (a.id < b.id ? 1 : -1))
  return out.map(({ id, score, hasLikes }) => ({ id, score, hasLikes }))
}

/** Photos ordered by likes received since `since` (only photos with at least one). */
async function rankByLikesSince(where: Prisma.PhotoWhereInput, since: Date, asOf: Date, near: LatLng | null): Promise<RankedId[]> {
  const counts = await likeCountsSince(since, asOf)
  const cands = (await eligibleCandidates(where, Array.from(counts.keys()))).filter((c) => withinRadius(c, near))
  cands.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || b.likeCount - a.likeCount || b.createdAt.getTime() - a.createdAt.getTime())
  return cands.map((c) => ({ id: c.id, score: counts.get(c.id) ?? 0, weekLikes: counts.get(c.id) ?? 0, hasLikes: true }))
}

// Small per-viewer cache of the unfiltered trending top 3 (badge "🔥 Trending").
const trendingCache = new Map<string, { at: number; ids: string[] }>()
async function trendingTop3(viewerId: string, now: Date): Promise<Set<string>> {
  const hit = trendingCache.get(viewerId)
  if (hit && now.getTime() - hit.at < 60_000) return new Set(hit.ids)
  const ranked = await rankTrending({ AND: [exploreEligibleWhere(viewerId, now), { createdAt: { lte: now } }] }, now, null)
  const ids = ranked.filter((r) => r.hasLikes).slice(0, 3).map((r) => r.id)
  if (trendingCache.size > 5000) trendingCache.clear()
  trendingCache.set(viewerId, { at: now.getTime(), ids })
  return new Set(ids)
}

async function hydrate(ids: string[]): Promise<ExplorePhotoRow[]> {
  if (!ids.length) return []
  const rows = await db.photo.findMany({ where: { id: { in: ids } }, select: explorePhotoSelect })
  const map = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => map.get(id)).filter((r): r is ExplorePhotoRow => !!r)
}

async function likedSet(viewerId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await db.photoLike.findMany({ where: { userId: viewerId, photoId: { in: ids } }, select: { photoId: true } })
  return new Set(rows.map((r) => r.photoId))
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ExplorePage {
  photos: ExplorePhoto[]
  nextCursor: string | null
  /** True when "Near me" was asked for but the viewer has no location. */
  needsLocation: boolean
}

export async function getExplorePage(
  viewer: ExploreViewer,
  sort: ExploreSort,
  filters: ExploreFilters,
  cursor: string | null,
  pageSize = EXPLORE_PAGE_SIZE,
): Promise<ExplorePage> {
  const now = new Date()
  const { asOf, offset } = decodeCursor(cursor, now)
  const needsLocation = filters.near && !viewer.location
  const near = filters.near ? viewer.location : null
  if (needsLocation) return { photos: [], nextCursor: null, needsLocation }

  const where: Prisma.PhotoWhereInput = {
    AND: [exploreEligibleWhere(viewer.id, now), exploreFilterWhere(filters, near, now), { createdAt: { lte: asOf } }],
  }

  let pageIds: string[]
  let nextOffset: number | null
  let ranks: Map<string, number> | undefined
  let weekLikes: Map<string, number> | undefined

  if (sort === 'trending' || sort === 'week') {
    const ranked = sort === 'trending'
      ? await rankTrending(where, asOf, near)
      : await rankByLikesSince(where, startOfWeekSAST(now), asOf, near)
    const slice = ranked.slice(offset, offset + pageSize)
    pageIds = slice.map((r) => r.id)
    nextOffset = offset + pageSize < ranked.length ? offset + pageSize : null
    ranks = new Map(slice.map((r, i) => [r.id, offset + i + 1]))
    if (sort === 'week') weekLikes = new Map(slice.map((r) => [r.id, r.weekLikes ?? 0]))
  } else {
    const rows = await db.photo.findMany({
      where,
      select: candidateSelect,
      orderBy: sort === 'all'
        ? [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: pageSize + 1,
    })
    const more = rows.length > pageSize
    const page = rows.slice(0, pageSize).map((r) => toCandidate(r, now))
    pageIds = page.filter((c) => withinRadius(c, near)).map((c) => c.id)
    nextOffset = more ? offset + pageSize : null
    if (sort === 'all') ranks = new Map(page.map((c, i) => [c.id, offset + i + 1]))
  }

  const [rows, liked, trendingIds] = await Promise.all([hydrate(pageIds), likedSet(viewer.id, pageIds), trendingTop3(viewer.id, now)])
  return {
    photos: serialize(rows, { viewerId: viewer.id, viewerLoc: viewer.location, likedIds: liked, trendingIds, ranks, weekLikes, now }),
    nextCursor: nextOffset !== null ? encodeCursor(asOf, nextOffset) : null,
    needsLocation: false,
  }
}

/**
 * "Top photos this week": top 10 by likes since Monday 00:00 SAST (no filters).
 * Early in the week (fewer than 3 liked photos) it falls back to the last 7 days.
 */
export async function getTopThisWeek(viewer: ExploreViewer): Promise<{ photos: ExplorePhoto[]; period: 'week' | 'rolling' }> {
  const now = new Date()
  const where: Prisma.PhotoWhereInput = exploreEligibleWhere(viewer.id, now)
  let period: 'week' | 'rolling' = 'week'
  let ranked = await rankByLikesSince(where, startOfWeekSAST(now), now, null)
  if (ranked.length < 3) {
    period = 'rolling'
    ranked = await rankByLikesSince(where, new Date(now.getTime() - HOT_WINDOW_DAYS * 24 * HOUR), now, null)
  }
  const top = ranked.slice(0, TOP_STRIP_SIZE)
  const ids = top.map((r) => r.id)
  const [rows, liked, trendingIds] = await Promise.all([hydrate(ids), likedSet(viewer.id, ids), trendingTop3(viewer.id, now)])
  return {
    photos: serialize(rows, {
      viewerId: viewer.id, viewerLoc: viewer.location, likedIds: liked, trendingIds,
      ranks: new Map(top.map((r, i) => [r.id, i + 1])), weekLikes: new Map(top.map((r) => [r.id, r.weekLikes ?? 0])), now,
    }),
    period,
  }
}

/**
 * One photo for the full-screen viewer / deep links (`?photo=<id>`). Owners
 * may always open their own public photos, even when opted out of Explore.
 */
export async function getExplorePhoto(viewer: ExploreViewer, photoId: string): Promise<ExplorePhoto | null> {
  const now = new Date()
  const row = await db.photo.findFirst({
    where: {
      id: photoId,
      OR: [
        exploreEligibleWhere(viewer.id, now),
        { userId: viewer.id, isPrivate: false, OR: [{ albumId: null }, { album: { isPrivate: false, NOT: { name: { startsWith: '__' } } } }] },
      ],
    },
    select: explorePhotoSelect,
  })
  if (!row) return null
  const [liked, trendingIds] = await Promise.all([likedSet(viewer.id, [row.id]), trendingTop3(viewer.id, now)])
  return serialize([row], { viewerId: viewer.id, viewerLoc: viewer.location, likedIds: liked, trendingIds, now })[0]
}

/** Is the photo currently likeable by this viewer (eligible, not their own)? Returns its owner. */
export async function findLikeablePhoto(viewerId: string, photoId: string): Promise<{ id: string; userId: string; caption: string | null } | null> {
  return db.photo.findFirst({
    where: { AND: [{ id: photoId }, exploreEligibleWhere(viewerId)] },
    select: { id: true, userId: true, caption: true },
  })
}

// ── Like notifications ──────────────────────────────────────────────────────

export const PHOTO_LIKE_TYPE = 'PHOTO_LIKE'
const PUSH_WINDOW_MS = 10 * 60 * 1000
const recentPush = new Map<string, number>()

function likeTitle(firstName: string, others: number, photos: number): string {
  const what = photos > 1 ? 'your photos' : 'your photo'
  if (others <= 0) return `${firstName} liked ${what}`
  return `${firstName} and ${others} other${others === 1 ? '' : 's'} liked ${what}`
}

/**
 * In-app: one notification per photo while it is unread, updated as more
 * members like it ("Sipho and 3 others liked your photo"); the same member
 * liking again (e.g. after un-liking) never adds a second entry.
 * Push: at most one per owner per 10 minutes, summarising every unread like.
 */
export async function notifyPhotoLike(opts: { ownerId: string; photoId: string; caption: string | null; likerId: string }) {
  const { ownerId, photoId, caption, likerId } = opts
  const liker = await db.user.findUnique({ where: { id: likerId }, select: { username: true, profile: { select: { displayName: true } } } })
  const likerName = liker?.profile?.displayName || liker?.username || 'Someone'
  const url = `/gallery/explore?photo=${photoId}`
  const since = new Date(Date.now() - 7 * 24 * HOUR)

  const existing = await db.notification.findFirst({
    where: { userId: ownerId, type: PHOTO_LIKE_TYPE, isRead: false, createdAt: { gte: since }, data: { path: ['photoId'], equals: photoId } },
    orderBy: { createdAt: 'desc' },
  })
  const body = caption ? `“${caption.slice(0, 60)}${caption.length > 60 ? '…' : ''}” is getting love in Explore` : 'Your photo is getting love in Explore'
  if (existing) {
    const data = (existing.data && typeof existing.data === 'object' ? existing.data : {}) as Record<string, unknown>
    const likerIds = Array.isArray(data.likerIds) ? (data.likerIds as unknown[]).filter((x): x is string => typeof x === 'string') : []
    if (likerIds.includes(likerId)) return
    const ids = [likerId, ...likerIds].slice(0, 50)
    const count = (typeof data.count === 'number' ? data.count : likerIds.length) + 1
    await db.notification.update({
      where: { id: existing.id },
      data: { title: likeTitle(likerName, count - 1, 1), body, createdAt: new Date(), data: { ...data, url, photoId, likerIds: ids, count } },
    })
  } else {
    // A like already notified (and read) earlier for this photo by this member: don't notify again.
    const already = await db.notification.findFirst({
      where: { userId: ownerId, type: PHOTO_LIKE_TYPE, createdAt: { gte: since }, data: { path: ['photoId'], equals: photoId }, AND: [{ data: { path: ['likerIds'], array_contains: [likerId] } }] },
      select: { id: true },
    })
    if (already) return
    await db.notification.create({
      data: { userId: ownerId, type: PHOTO_LIKE_TYPE, title: likeTitle(likerName, 0, 1), body, data: { url, photoId, likerIds: [likerId], count: 1 } },
    })
  }

  // Push, deduped per owner per 10 min (in-process guard + DB marker across restarts).
  const now = Date.now()
  const last = recentPush.get(ownerId)
  if (last && now - last < PUSH_WINDOW_MS) return
  const lastPushed = await db.notification.findFirst({
    where: { userId: ownerId, type: PHOTO_LIKE_TYPE, data: { path: ['pushedAt'], gte: now - PUSH_WINDOW_MS } },
    select: { id: true },
  })
  if (lastPushed) return
  recentPush.set(ownerId, now)
  if (recentPush.size > 10_000) recentPush.clear()

  const unread = await db.notification.findMany({
    where: { userId: ownerId, type: PHOTO_LIKE_TYPE, isRead: false, createdAt: { gte: since } },
    select: { id: true, data: true },
    take: 50,
  })
  const likers = new Set<string>()
  for (const n of unread) {
    const d = (n.data ?? {}) as Record<string, unknown>
    if (Array.isArray(d.likerIds)) for (const id of d.likerIds) if (typeof id === 'string') likers.add(id)
  }
  likers.delete(likerId)
  const latest = await db.notification.findFirst({
    where: { userId: ownerId, type: PHOTO_LIKE_TYPE, data: { path: ['photoId'], equals: photoId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, data: true },
  })
  if (latest) {
    await db.notification.update({
      where: { id: latest.id },
      data: { data: { ...((latest.data ?? {}) as Record<string, unknown>), pushedAt: now } },
    }).catch(() => {})
  }
  sendPushToUser(ownerId, {
    title: likeTitle(likerName, likers.size, unread.length),
    body: 'See who’s loving your photos in Explore',
    url: unread.length > 1 ? '/gallery' : url,
    tag: 'photo-like',
  }).catch(() => {})
}
