// Shared member-search logic used by /api/members, the /members server page
// and /api/picks. Not a route file (Next only treats route.ts as a route).
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isBoosted, isTravelling } from '@/lib/premium'
import { entitlements, planFor, type Entitlements, type PlanTier } from '@/lib/plans'
import { activeStatus } from '@/components/status/status'
import { boundingBox, distanceKm, formatDistance } from '@/lib/geo'
import { compatibility, ageFromDob, type CompatInput } from '@/lib/compat'
import {
  ageFrom, categoryOf, coupleTypeBadge, effectiveInterestedIn, legacyValuesWanting,
  parseCoupleMembers, LEGACY_WHO_VALUES, type Category, type CoupleType,
} from '@/lib/identity'

export interface ProfilePrompt {
  question: string
  answer: string
}

export interface MemberResult {
  id: string
  username: string
  isVerified: boolean
  displayName?: string
  age?: number
  city?: string
  country?: string
  bio?: string
  interests: string[]
  profilePhotoUrl?: string
  isOnline?: boolean
  membershipTier?: 'FREE' | 'GOLD' | 'PLATINUM'
  isBoosted: boolean
  compatibility: number
  compatibilityReasons: string[]
  sharedInterests: string[]
  prompts: ProfilePrompt[]
  distance?: string
  distanceKm?: number
  /** Shown next to the name (individuals only; couples show names instead). */
  pronouns?: string
  isCouple: boolean
  coupleType?: string
  /** e.g. "FF couple" */
  coupleBadge?: string
  /** Couples: both partners' ages, e.g. [31, 34] */
  ages?: number[]
  /** Live status ("Free tonight"), only while statusUntil is in the future. */
  status?: { text: string; emoji?: string }
  /** Travel mode: the member is visiting the city being browsed. */
  visiting?: { city: string; until: string }
  /** Platinum spotlight slot. */
  isSpotlight?: boolean
}

export interface CallerContext {
  userId: string
  role?: string
  paid: boolean
  tier: PlanTier
  ent: Entitlements
  /** Where the caller browses from: their travel destination while travel mode is live, else home. */
  city: string | null
  homeCity: string | null
  /** Active travel mode (Gold+ only), else null. */
  travel: { city: string; country: string | null; until: Date } | null
  latitude: number | null
  longitude: number | null
  /** What kind of member the caller is, for mutual-interest matching. */
  category: Category | null
  /** Who the caller would like to meet ([] = open to everyone). */
  interestedIn: Category[]
  compat: CompatInput
}

export async function getCallerContext(userId: string, role?: string): Promise<CallerContext> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: {
      profile: {
        select: {
          membershipTier: true,
          city: true,
          latitude: true,
          longitude: true,
          lookingFor: true,
          interestedIn: true,
          intentions: true,
          isCouple: true,
          gender: true,
          dateOfBirth: true,
          travelCity: true,
          travelCountry: true,
          travelLat: true,
          travelLng: true,
          travelUntil: true,
        },
      },
      interests: { select: { interest: { select: { name: true } } } },
    },
  })
  const p = me?.profile
  const category = p ? categoryOf(p) : null
  const interestedIn = p ? effectiveInterestedIn(p) : []
  const tier = planFor(p?.membershipTier, role)
  const ent = entitlements(tier)
  // Travel mode: browse as if located in the destination. Lapsed plans fall back to home.
  const travel = ent.travelMode && p && isTravelling(p)
    ? { city: p.travelCity!, country: p.travelCountry ?? null, until: p.travelUntil! }
    : null
  const latitude = travel ? (p?.travelLat ?? null) : (p?.latitude ?? null)
  const longitude = travel ? (p?.travelLng ?? null) : (p?.longitude ?? null)
  const city = travel ? travel.city : (p?.city ?? null)
  return {
    userId,
    role,
    paid: tier !== 'FREE',
    tier,
    ent,
    city,
    homeCity: p?.city ?? null,
    travel,
    latitude,
    longitude,
    category,
    interestedIn,
    compat: {
      interests: me?.interests.map((i) => i.interest.name) ?? [],
      category,
      interestedIn,
      intentions: p?.intentions ?? [],
      age: ageFromDob(p?.dateOfBirth),
      city,
      latitude,
      longitude,
    },
  }
}

/** Profiles that are snoozed (indefinitely or until a future date) are hidden. */
export function notSnoozed(now = new Date()): Prisma.ProfileWhereInput {
  return {
    NOT: {
      isSnoozed: true,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { gt: now } }],
    },
  }
}

/**
 * Members in a city: those who live there, plus Gold+ members whose travel
 * mode currently points there (they show a "Visiting" badge).
 */
export function cityWhere(city: string, now = new Date()): Prisma.ProfileWhereInput {
  return {
    OR: [
      { city: { contains: city, mode: 'insensitive' } },
      {
        travelCity: { equals: city, mode: 'insensitive' },
        travelUntil: { gt: now },
        membershipTier: { in: ['GOLD', 'PLATINUM'] },
      },
    ],
  }
}

const NB_GENDERS: ('NON_BINARY' | 'OTHER')[] = ['NON_BINARY', 'OTHER']

/** Profiles in a given category (COUPLE / MAN / WOMAN / NON_BINARY). */
export function categoryWhere(cat: Category, coupleTypes?: CoupleType[]): Prisma.ProfileWhereInput {
  if (cat === 'COUPLE') return coupleTypes?.length ? { isCouple: true, coupleType: { in: coupleTypes } } : { isCouple: true }
  if (cat === 'NON_BINARY') return { isCouple: false, gender: { in: NB_GENDERS } }
  return { isCouple: false, gender: cat }
}

/**
 * Mutual-interest filter: the caller would like to meet the candidate's
 * category AND the candidate would like to meet the caller's category.
 * Permissive when either side has no preference (or no known category).
 * Hidden gender/orientation still count here; they are just never displayed.
 */
export function mutualInterestWhere(caller: Pick<CallerContext, 'category' | 'interestedIn'>): Prisma.ProfileWhereInput[] {
  const out: Prisma.ProfileWhereInput[] = []
  if (caller.interestedIn.length) {
    out.push({
      OR: [
        ...caller.interestedIn.map((c) => categoryWhere(c)),
        { isCouple: false, gender: null }, // category unknown → don't exclude
      ],
    })
  }
  if (caller.category) {
    out.push({
      OR: [
        { interestedIn: { has: caller.category } },
        // Legacy members who only have lookingFor (MAN/WOMAN/COUPLE/ANY)
        { interestedIn: { isEmpty: true }, lookingFor: { hasSome: legacyValuesWanting(caller.category) } },
        // No preference at all
        { interestedIn: { isEmpty: true }, NOT: { lookingFor: { hasSome: LEGACY_WHO_VALUES } } },
      ],
    })
  }
  return out
}

/** Ids of users the caller has blocked or been blocked by. */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId))
}

export const memberSelect = {
  id: true,
  username: true,
  isVerified: true,
  profile: {
    select: {
      displayName: true,
      profilePhoto: true,
      city: true,
      country: true,
      gender: true,
      orientation: true,
      lookingFor: true,
      membershipTier: true,
      isOnline: true,
      lastSeen: true,
      dateOfBirth: true,
      bio: true,
      boostedUntil: true,
      prompts: true,
      latitude: true,
      longitude: true,
      interestedIn: true,
      intentions: true,
      isCouple: true,
      coupleType: true,
      coupleMembers: true,
      pronouns: true,
      statusText: true,
      statusEmoji: true,
      statusUntil: true,
      travelCity: true,
      travelUntil: true,
      partner: { select: { dateOfBirth: true } },
    },
  },
  photos: {
    where: { isProfile: true, isPrivate: false },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
  interests: {
    select: { interest: { select: { name: true } } },
  },
} satisfies Prisma.UserSelect

type SelectedUser = Prisma.UserGetPayload<{ select: typeof memberSelect }>

function parsePrompts(raw: Prisma.JsonValue | null | undefined): ProfilePrompt[] {
  if (!Array.isArray(raw)) return []
  const out: ProfilePrompt[] = []
  for (const item of raw) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const q = (item as Record<string, unknown>).question
      const a = (item as Record<string, unknown>).answer
      if (typeof q === 'string' && typeof a === 'string' && a.trim()) {
        out.push({ question: q, answer: a })
      }
    }
  }
  return out
}

function coupleExtras(p: NonNullable<SelectedUser['profile']>): Pick<MemberResult, 'coupleType' | 'coupleBadge' | 'ages'> {
  const ages: number[] = []
  if (p.partner) {
    for (const d of [p.dateOfBirth, p.partner.dateOfBirth]) {
      const a = ageFrom(d); if (a !== undefined) ages.push(a)
    }
  } else {
    const members = parseCoupleMembers(p.coupleMembers)
    if (members.length === 0) { const a = ageFrom(p.dateOfBirth); if (a !== undefined) ages.push(a) }
    members.forEach((m, i) => {
      const a = ageFrom(i === 0 ? p.dateOfBirth : m.dateOfBirth); if (a !== undefined) ages.push(a)
    })
  }
  return {
    ...(p.coupleType ? { coupleType: p.coupleType, coupleBadge: coupleTypeBadge(p.coupleType) } : {}),
    ...(ages.length ? { ages } : {}),
  }
}

function liveStatus(p: NonNullable<SelectedUser['profile']>): MemberResult['status'] {
  const s = activeStatus(p)
  if (!s) return undefined
  return { text: s.text.slice(0, 60), ...(s.emoji ? { emoji: s.emoji } : {}) }
}

function visitingFor(p: NonNullable<SelectedUser['profile']>, focusCity: string | null | undefined): MemberResult['visiting'] {
  if (!focusCity || !p.travelCity || !p.travelUntil) return undefined
  if (p.travelUntil.getTime() <= Date.now()) return undefined
  if (p.membershipTier !== 'GOLD' && p.membershipTier !== 'PLATINUM') return undefined
  if (p.travelCity.toLowerCase() !== focusCity.toLowerCase()) return undefined
  if (p.city && p.city.toLowerCase() === focusCity.toLowerCase()) return undefined // lives there anyway
  return { city: p.travelCity, until: p.travelUntil.toISOString() }
}

/**
 * Map a DB user to the public card shape. Never exposes raw coordinates.
 * `focusCity` is the city being browsed (defaults to the caller's own / travel
 * city) — members visiting it get a `visiting` badge.
 */
export function toMemberResult(u: SelectedUser, caller: CallerContext, promptLimit = 1, focusCity?: string | null): MemberResult {
  const p = u.profile
  const visiting = p ? visitingFor(p, focusCity ?? caller.city) : undefined
  const status = p ? liveStatus(p) : undefined
  const interests = u.interests.map((i) => i.interest.name).filter(Boolean)
  const age = ageFromDob(p?.dateOfBirth) ?? undefined
  const compat = compatibility(caller.compat, {
    interests,
    category: p ? categoryOf(p) : null,
    interestedIn: p ? effectiveInterestedIn(p) : [],
    intentions: p?.intentions ?? [],
    age,
    city: p?.city ?? null,
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
  })

  let km: number | undefined
  if (
    caller.latitude != null && caller.longitude != null &&
    p?.latitude != null && p?.longitude != null
  ) {
    km = distanceKm(caller.latitude, caller.longitude, p.latitude, p.longitude)
  }

  return {
    id: u.id,
    username: u.username,
    isVerified: u.isVerified,
    displayName: p?.displayName ?? undefined,
    age,
    city: visiting ? visiting.city : (p?.city ?? undefined),
    country: visiting ? undefined : (p?.country ?? undefined),
    bio: p?.bio ?? undefined,
    interests,
    profilePhotoUrl: u.photos[0]?.url ?? p?.profilePhoto ?? undefined,
    isOnline: p?.isOnline ?? undefined,
    membershipTier: p?.membershipTier,
    isBoosted: isBoosted(p?.boostedUntil),
    compatibility: compat.score,
    compatibilityReasons: compat.reasons,
    sharedInterests: compat.sharedInterests,
    prompts: parsePrompts(p?.prompts).slice(0, promptLimit),
    isCouple: !!p?.isCouple,
    ...(p?.isCouple ? coupleExtras(p) : p?.pronouns ? { pronouns: p.pronouns } : {}),
    ...(km !== undefined && !visiting ? { distance: formatDistance(km) ?? undefined, distanceKm: Math.round(km) } : {}),
    ...(status ? { status } : {}),
    ...(visiting ? { visiting } : {}),
  }
}

export interface SearchParamsInput {
  page?: string | null
  limit?: string | null
  gender?: string | null
  ageMin?: string | null
  ageMax?: string | null
  city?: string | null
  tier?: string | null
  lookingFor?: string | null
  online?: string | null
  sort?: string | null
  maxKm?: string | null
  discover?: string | null
  /** "Show me": comma list of WOMAN, MAN, NON_BINARY, COUPLE */
  show?: string | null
  /** Couple-type sub-filter when COUPLE is shown: comma list of MF, FF, MM, MX */
  coupleType?: string | null
  /** Gold+: "1" = every city (ignores the default travel destination). */
  anyCity?: string | null
  /** Search radius in km (10/25/50/100/250) or "any" (Anywhere, Gold+). Default 50. */
  radius?: string | null
  // ── Advanced filters (Gold+; ignored for plans without advancedFilters) ──
  heightMin?: string | null
  heightMax?: string | null
  /** comma list of BODY_TYPE_OPTIONS values */
  bodyType?: string | null
  /** comma list of INTENTION_OPTIONS values */
  intentions?: string | null
  /** comma list of languages */
  languages?: string | null
  /** "1" = verified members only */
  verified?: string | null
  /** "1" = only members with a public photo */
  photos?: string | null
  /** "1" = active in the last 7 days */
  active?: string | null
}

export const ADVANCED_FILTER_KEYS = ['heightMin', 'heightMax', 'bodyType', 'intentions', 'languages', 'verified', 'photos', 'active'] as const

/** Advanced filter params the caller asked for (non-empty values). */
export function requestedAdvancedFilters(params: SearchParamsInput): string[] {
  return ADVANCED_FILTER_KEYS.filter((k) => {
    const v = params[k]
    return typeof v === 'string' && v.trim() !== '' && v !== '0'
  })
}

function csv(v: string | null | undefined, max = 12): string[] {
  return (v ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, 40))
}

export interface SearchResult {
  members: MemberResult[]
  total: number
  page: number
  limit: number
  callerHasLocation: boolean
  effectiveCity: string | null
  /** Radius actually applied in km; null = Anywhere (or no location to measure from). */
  radiusKm: number | null
  /** Sort actually applied. */
  sort: SortKey
  /** How many results (at the end of the list) have no location, shown as "Distance unknown". */
  unknownDistance: number
  /** Advanced filters that were requested but not applied because the plan doesn't include them. */
  ignoredFilters: string[]
}

export type SortKey = 'nearest' | 'active' | 'new' | 'match'
export const RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const
export const DEFAULT_RADIUS_KM = 50

/**
 * Resolve the requested radius against the plan. "any" (or a missing value
 * with sort-only callers) means Anywhere, which only plans with
 * maxSearchRadiusKm === null get; others are capped at their maximum.
 */
export function resolveRadius(raw: string | null | undefined, ent: Entitlements): number | null {
  const max = ent.maxSearchRadiusKm
  if (raw === 'any') return max
  const km = raw ? parseFloat(raw) : DEFAULT_RADIUS_KM
  const v = Number.isFinite(km) && km > 0 ? km : DEFAULT_RADIUS_KM
  return max === null ? Math.min(v, 20000) : Math.min(v, max)
}

function sortKeyOf(raw: string | null | undefined, hasLocation: boolean): SortKey {
  switch (raw) {
    case 'nearest': case 'distance': return hasLocation ? 'nearest' : 'active'
    case 'active': case 'online': case 'verified': return 'active'
    case 'new': return 'new'
    case 'match': return 'match'
    default: return hasLocation ? 'nearest' : 'active'
  }
}

// Upper bound on candidates evaluated in memory (the community is small;
// candidates are the most recently active first).
const CANDIDATE_CAP = 1500

/**
 * Location-first member search.
 *  - With a location (home coordinates, or travel destination coordinates),
 *    members within the radius come first; members without coordinates are
 *    never dropped — they follow in a "Distance unknown" group.
 *  - Without a location (or a radius of Anywhere) everyone matching the
 *    filters is listed, most recently active first.
 *  - Travel mode without coordinates browses the destination city by name.
 *  - The city text filter is part of "Anywhere" (Gold+).
 */
export async function searchMembers(caller: CallerContext, params: SearchParamsInput): Promise<SearchResult> {
  const now = new Date()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const limit = Math.min(Math.max(parseInt(params.limit ?? '20', 10) || 20, 1), 100)
  const callerHasLocation = caller.latitude != null && caller.longitude != null
  const sort = sortKeyOf(params.sort, callerHasLocation)
  // Legacy maxKm param still works as a radius
  const radiusParam = params.radius ?? params.maxKm ?? null
  const radiusKm = callerHasLocation ? resolveRadius(radiusParam, caller.ent) : null

  // City: an explicit city filter (Gold+), or the travel destination when the
  // traveller has no destination coordinates.
  const effectiveCity = caller.ent.searchAnyCity && params.city
    ? params.city
    : caller.travel && !callerHasLocation && params.anyCity !== '1'
      ? caller.travel.city
      : null

  const profileWhere: Prisma.ProfileWhereInput = { AND: [notSnoozed(now), ...mutualInterestWhere(caller)] }
  const and = profileWhere.AND as Prisma.ProfileWhereInput[]
  const userAnd: Prisma.UserWhereInput[] = []

  // Advanced filters (Gold+). Never filters on ethnicity.
  const wantedAdvanced = requestedAdvancedFilters(params)
  const ignoredFilters = caller.ent.advancedFilters ? [] : wantedAdvanced
  if (caller.ent.advancedFilters && wantedAdvanced.length) {
    const hMin = parseInt(params.heightMin ?? '', 10)
    const hMax = parseInt(params.heightMax ?? '', 10)
    if (hMin >= 100 && hMin <= 250) and.push({ heightCm: { gte: hMin } })
    if (hMax >= 100 && hMax <= 250) and.push({ heightCm: { lte: hMax } })
    const bodyTypes = csv(params.bodyType)
    if (bodyTypes.length) and.push({ bodyType: { in: bodyTypes } })
    const intentions = csv(params.intentions)
    if (intentions.length) and.push({ intentions: { hasSome: intentions } })
    const languages = csv(params.languages)
    if (languages.length) and.push({ languages: { hasSome: languages } })
    if (params.verified === '1') userAnd.push({ isVerified: true })
    if (params.photos === '1') {
      userAnd.push({ OR: [{ profile: { profilePhoto: { not: null } } }, { photos: { some: { isPrivate: false } } }] })
    }
    if (params.active === '1') and.push({ lastSeen: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } })
  }

  // "Show me" filter (new) — falls back to the legacy single `gender` param.
  const VALID_CATS: Category[] = ['WOMAN', 'MAN', 'NON_BINARY', 'COUPLE']
  const show = (params.show ?? (params.gender && params.gender !== 'ALL' ? (params.gender === 'OTHER' ? 'NON_BINARY' : params.gender) : ''))
    .split(',').filter((c): c is Category => (VALID_CATS as string[]).includes(c))
  const coupleTypes = (params.coupleType ?? '').split(',')
    .filter((t): t is CoupleType => ['MF', 'FF', 'MM', 'MX'].includes(t))
  if (show.length) {
    and.push({ OR: Array.from(new Set(show)).map((c) => categoryWhere(c, c === 'COUPLE' ? coupleTypes : undefined)) })
  }
  if (effectiveCity) and.push(cityWhere(effectiveCity, now))
  if (params.tier === 'FREE' || params.tier === 'GOLD' || params.tier === 'PLATINUM') {
    and.push({ membershipTier: params.tier })
  }
  if (params.lookingFor) and.push({ lookingFor: { has: params.lookingFor } })
  if (params.online === '1') and.push({ isOnline: true })
  const ageMax = parseInt(params.ageMax ?? '', 10)
  const ageMin = parseInt(params.ageMin ?? '', 10)
  if (ageMax > 0) {
    const oldestDob = new Date(now)
    oldestDob.setFullYear(oldestDob.getFullYear() - ageMax - 1)
    and.push({ dateOfBirth: { gt: oldestDob } })
  }
  if (ageMin > 0) {
    const youngestDob = new Date(now)
    youngestDob.setFullYear(youngestDob.getFullYear() - ageMin)
    and.push({ dateOfBirth: { lte: youngestDob } })
  }
  if (radiusKm !== null) {
    // Within the bounding box, or no coordinates at all ("Distance unknown")
    const box = boundingBox(caller.latitude!, caller.longitude!, radiusKm)
    and.push({
      OR: [
        { latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } },
        { latitude: null },
        { longitude: null },
      ],
    })
  }

  const excludedIds = await getBlockedIds(caller.userId)

  // In discover mode, exclude already-liked / passed-within-5-days profiles
  if (params.discover === '1') {
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
    const existingActions = await db.like.findMany({
      where: {
        fromUserId: caller.userId,
        OR: [
          { type: { not: 'PASS' } },
          { type: 'PASS', createdAt: { gte: fiveDaysAgo } },
        ],
      },
      select: { toUserId: true },
    })
    excludedIds.push(...existingActions.map((l) => l.toUserId))
  }

  const userWhere: Prisma.UserWhereInput = {
    id: { not: caller.userId, notIn: excludedIds },
    isActive: true,
    profile: profileWhere,
    ...(userAnd.length ? { AND: userAnd } : {}),
  }

  const rows = await db.user.findMany({
    where: userWhere,
    select: memberSelect,
    orderBy: [{ profile: { lastSeen: 'desc' } }, { id: 'asc' }],
    take: CANDIDATE_CAP,
  })

  const results = rows.map((r) => {
    const member = toMemberResult(r, caller, 1, effectiveCity ?? caller.city)
    const km = member.distanceKm
    return { r, member, km }
  })
  const inRange = results.filter((x) => x.km === undefined || radiusKm === null || x.km <= radiusKm + 0.5)

  // Priority within a sort: boosted first, then plans with priorityInSearch.
  const TIER_RANK: Record<PlanTier, number> = {
    PLATINUM: entitlements('PLATINUM').priorityInSearch ? 2 : 0,
    GOLD: entitlements('GOLD').priorityInSearch ? 1 : 0,
    FREE: entitlements('FREE').priorityInSearch ? 1 : 0,
  }
  const createdById = new Map<string, number>()
  if (sort === 'new') {
    const created = await db.user.findMany({ where: { id: { in: inRange.map((x) => x.r.id) } }, select: { id: true, createdAt: true } })
    for (const c of created) createdById.set(c.id, c.createdAt.getTime())
  }
  type Row = (typeof inRange)[number]
  const lastSeen = (x: Row) => x.r.profile?.lastSeen?.getTime() ?? 0
  const priority = (x: Row) => (x.member.isBoosted ? 10 : 0) + TIER_RANK[x.member.membershipTier ?? 'FREE']
  const known = (x: Row) => (x.km === undefined ? 0 : 1)

  inRange.sort((x, y) => {
    // Members with a distance always come before "Distance unknown" when a radius applies
    if ((radiusKm !== null || sort === 'nearest') && known(x) !== known(y)) return known(y) - known(x)
    switch (sort) {
      case 'nearest':
        if (x.member.isBoosted !== y.member.isBoosted) return x.member.isBoosted ? -1 : 1
        if (x.km !== undefined && y.km !== undefined && Math.round(x.km) !== Math.round(y.km)) return x.km - y.km
        break
      case 'new':
        return (createdById.get(y.r.id) ?? 0) - (createdById.get(x.r.id) ?? 0)
      case 'match':
        if (x.member.compatibility !== y.member.compatibility) return y.member.compatibility - x.member.compatibility
        break
      case 'active': {
        const p = priority(y) - priority(x)
        if (p) return p
        const o = Number(!!y.member.isOnline) - Number(!!x.member.isOnline)
        if (o) return o
        break
      }
    }
    return lastSeen(y) - lastSeen(x)
  })

  const members = inRange.slice((page - 1) * limit, page * limit).map((x) => x.member)
  const unknownDistance = radiusKm !== null ? inRange.filter((x) => x.km === undefined).length : 0
  return {
    members, total: inRange.length, page, limit, callerHasLocation, effectiveCity,
    radiusKm, sort, unknownDistance, ignoredFilters,
  }
}

/** Small deterministic string hash (FNV-1a) for stable rotations. */
export function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const SPOTLIGHT_POOL = 60
const SPOTLIGHT_ACTIVE_DAYS = 14

/**
 * Spotlight: a few active Platinum members (plan entitlement `spotlight`)
 * shown at the top of discover and /members. Respects mutual interest,
 * blocks, snooze and deactivation; never includes the viewer, and never
 * spotlights incognito members. The selection rotates every hour.
 *
 * `excludeActed` drops members the viewer already liked / recently passed
 * (used by discover so a spotlight card isn't one they've swiped on).
 */
export async function getSpotlight(
  caller: CallerContext,
  opts: { limit?: number; excludeActed?: boolean; excludeIds?: string[] } = {},
): Promise<MemberResult[]> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 12)
  const now = new Date()
  const spotlightTiers = (['FREE', 'GOLD', 'PLATINUM'] as const).filter((t) => entitlements(t).spotlight)
  if (!spotlightTiers.length) return []

  const excluded = [...(opts.excludeIds ?? []), ...(await getBlockedIds(caller.userId))]
  if (opts.excludeActed) {
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
    const acted = await db.like.findMany({
      where: { fromUserId: caller.userId, OR: [{ type: { not: 'PASS' } }, { type: 'PASS', createdAt: { gte: fiveDaysAgo } }] },
      select: { toUserId: true },
    })
    excluded.push(...acted.map((a) => a.toUserId))
  }

  const pool = await db.user.findMany({
    where: {
      id: { not: caller.userId, notIn: excluded },
      isActive: true,
      profile: {
        AND: [
          notSnoozed(now),
          ...mutualInterestWhere(caller),
          { membershipTier: { in: [...spotlightTiers] } },
          { incognito: false },
          { lastSeen: { gte: new Date(now.getTime() - SPOTLIGHT_ACTIVE_DAYS * 24 * 60 * 60 * 1000) } },
        ],
      },
    },
    select: memberSelect,
    orderBy: [{ profile: { lastSeen: 'desc' } }, { id: 'asc' }],
    take: SPOTLIGHT_POOL,
  })

  const hourBucket = Math.floor(now.getTime() / (60 * 60 * 1000))
  return pool
    .map((u) => ({ u, k: hashString(`${caller.userId}:${u.id}:${hourBucket}`) }))
    .sort(localFirst(caller))
    .slice(0, limit)
    .map(({ u }) => ({ ...toMemberResult(u, caller), isSpotlight: true }))
}

/** Members in the caller's (home or travel) city rotate in first. */
function localFirst<T extends { u: SelectedUser; k: number }>(caller: CallerContext) {
  const city = caller.city?.toLowerCase() ?? null
  const local = (x: T) => {
    const p = x.u.profile
    if (!city || !p) return 0
    return (p.city?.toLowerCase() === city || (p.travelCity?.toLowerCase() === city && !!p.travelUntil && p.travelUntil.getTime() > Date.now())) ? 1 : 0
  }
  return (a: T, b: T) => local(b) - local(a) || a.k - b.k
}
