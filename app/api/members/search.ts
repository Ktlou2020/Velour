// Shared member-search logic used by /api/members, the /members server page
// and /api/picks. Not a route file (Next only treats route.ts as a route).
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isPaid, isBoosted } from '@/lib/premium'
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
}

export interface CallerContext {
  userId: string
  role?: string
  paid: boolean
  city: string | null
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
        },
      },
      interests: { select: { interest: { select: { name: true } } } },
    },
  })
  const p = me?.profile
  const category = p ? categoryOf(p) : null
  const interestedIn = p ? effectiveInterestedIn(p) : []
  const latitude = p?.latitude ?? null
  const longitude = p?.longitude ?? null
  return {
    userId,
    role,
    paid: isPaid(p?.membershipTier, role),
    city: p?.city ?? null,
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
      city: p?.city ?? null,
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

/** Map a DB user to the public card shape. Never exposes raw coordinates. */
export function toMemberResult(u: SelectedUser, caller: CallerContext, promptLimit = 1): MemberResult {
  const p = u.profile
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
    city: p?.city ?? undefined,
    country: p?.country ?? undefined,
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
    ...(km !== undefined ? { distance: formatDistance(km) ?? undefined, distanceKm: Math.round(km) } : {}),
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
}

export interface SearchResult {
  members: MemberResult[]
  total: number
  page: number
  limit: number
  callerHasLocation: boolean
  effectiveCity: string | null
}

// Upper bound on candidates evaluated in memory for distance search / sort.
const DISTANCE_CANDIDATE_CAP = 2000
// Max boosted profiles surfaced at the top of page 1.
const BOOSTED_CAP = 8

export async function searchMembers(caller: CallerContext, params: SearchParamsInput): Promise<SearchResult> {
  const now = new Date()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const limit = Math.min(Math.max(parseInt(params.limit ?? '20', 10) || 20, 1), 100)
  const sortBy = params.sort ?? 'online'
  const callerHasLocation = caller.latitude != null && caller.longitude != null
  const rawKm = params.maxKm ? parseFloat(params.maxKm) : NaN
  const maxKm = callerHasLocation && rawKm > 0 ? Math.min(rawKm, 20000) : null
  const sortByDistance = sortBy === 'distance' && callerHasLocation

  // FREE users are locked to their own city regardless of query param
  const effectiveCity = caller.paid ? (params.city || null) : caller.city

  const profileWhere: Prisma.ProfileWhereInput = { AND: [notSnoozed(now), ...mutualInterestWhere(caller)] }
  const and = profileWhere.AND as Prisma.ProfileWhereInput[]

  // "Show me" filter (new) — falls back to the legacy single `gender` param.
  const VALID_CATS: Category[] = ['WOMAN', 'MAN', 'NON_BINARY', 'COUPLE']
  const show = (params.show ?? (params.gender && params.gender !== 'ALL' ? (params.gender === 'OTHER' ? 'NON_BINARY' : params.gender) : ''))
    .split(',').filter((c): c is Category => (VALID_CATS as string[]).includes(c))
  const coupleTypes = (params.coupleType ?? '').split(',')
    .filter((t): t is CoupleType => ['MF', 'FF', 'MM', 'MX'].includes(t))
  if (show.length) {
    and.push({ OR: Array.from(new Set(show)).map((c) => categoryWhere(c, c === 'COUPLE' ? coupleTypes : undefined)) })
  }
  if (effectiveCity) and.push({ city: { contains: effectiveCity, mode: 'insensitive' } })
  if (params.tier === 'FREE' || params.tier === 'GOLD' || params.tier === 'PLATINUM') {
    and.push({ membershipTier: params.tier })
  }
  if (params.lookingFor) and.push({ lookingFor: { has: params.lookingFor } })
  if (params.online === '1') and.push({ isOnline: true })
  if (params.ageMax) {
    const oldestDob = new Date(now)
    oldestDob.setFullYear(oldestDob.getFullYear() - parseInt(params.ageMax, 10))
    and.push({ dateOfBirth: { lte: oldestDob } })
  }
  if (params.ageMin) {
    const youngestDob = new Date(now)
    youngestDob.setFullYear(youngestDob.getFullYear() - parseInt(params.ageMin, 10))
    and.push({ dateOfBirth: { gte: youngestDob } })
  }
  if (maxKm !== null) {
    const box = boundingBox(caller.latitude!, caller.longitude!, maxKm)
    and.push({
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    })
  } else if (sortByDistance) {
    and.push({ latitude: { not: null }, longitude: { not: null } })
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
  }

  // ── Path A: distance radius or distance sort ─────────────────────────────
  // Exact radius filtering can't be expressed in Prisma, so we pull the
  // (bounding-box-limited) candidates' coordinates, filter/sort in memory,
  // paginate, then load full card data for just the requested page.
  if (maxKm !== null || sortByDistance) {
    const candidates = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        createdAt: true,
        isVerified: true,
        profile: {
          select: {
            latitude: true, longitude: true, boostedUntil: true,
            membershipTier: true, isOnline: true, lastSeen: true,
          },
        },
      },
      orderBy: [{ profile: { lastSeen: 'desc' } }, { id: 'asc' }],
      take: DISTANCE_CANDIDATE_CAP,
    })

    const TIER_RANK = { PLATINUM: 2, GOLD: 1, FREE: 0 } as const
    const scored = candidates
      .map((c) => {
        const p = c.profile
        const km = p?.latitude != null && p?.longitude != null
          ? distanceKm(caller.latitude!, caller.longitude!, p.latitude, p.longitude)
          : Infinity
        return { c, km }
      })
      .filter(({ km }) => maxKm === null || km <= maxKm)

    scored.sort((x, y) => {
      if (sortByDistance) return x.km - y.km
      if (sortBy === 'new') return y.c.createdAt.getTime() - x.c.createdAt.getTime()
      if (sortBy === 'verified' && x.c.isVerified !== y.c.isVerified) return x.c.isVerified ? -1 : 1
      if (sortBy !== 'verified') {
        // Default priority: boosted → paid tier → online → recently seen
        const bx = isBoosted(x.c.profile?.boostedUntil) ? 1 : 0
        const by = isBoosted(y.c.profile?.boostedUntil) ? 1 : 0
        if (bx !== by) return by - bx
        const tx = TIER_RANK[x.c.profile?.membershipTier ?? 'FREE']
        const ty = TIER_RANK[y.c.profile?.membershipTier ?? 'FREE']
        if (tx !== ty) return ty - tx
        const ox = x.c.profile?.isOnline ? 1 : 0
        const oy = y.c.profile?.isOnline ? 1 : 0
        if (ox !== oy) return oy - ox
      }
      return (y.c.profile?.lastSeen?.getTime() ?? 0) - (x.c.profile?.lastSeen?.getTime() ?? 0)
    })

    const pageIds = scored.slice((page - 1) * limit, page * limit).map(({ c }) => c.id)
    const rows = pageIds.length
      ? await db.user.findMany({ where: { id: { in: pageIds } }, select: memberSelect })
      : []
    const byId = new Map(rows.map((r) => [r.id, r]))
    const members = pageIds
      .map((id) => byId.get(id))
      .filter((r): r is SelectedUser => !!r)
      .map((r) => toMemberResult(r, caller))

    return { members, total: scored.length, page, limit, callerHasLocation, effectiveCity }
  }

  // ── Path B: plain DB pagination ──────────────────────────────────────────
  // Priority for the default sort: boosted profiles are fetched separately and
  // excluded from the main query on every page, then prepended on page 1.
  // The main query orders by membershipTier desc (enum order FREE<GOLD<PLATINUM,
  // so desc = PLATINUM, GOLD, FREE), then online, then lastSeen.
  const isDefaultSort = sortBy !== 'new' && sortBy !== 'verified'
  let boosted: SelectedUser[] = []
  if (isDefaultSort) {
    boosted = await db.user.findMany({
      where: { ...userWhere, profile: { AND: [profileWhere, { boostedUntil: { gt: now } }] } },
      select: memberSelect,
      orderBy: [{ profile: { boostedUntil: 'desc' } }],
      take: BOOSTED_CAP,
    })
  }
  const boostedIds = boosted.map((b) => b.id)
  const mainWhere: Prisma.UserWhereInput = boostedIds.length
    ? { ...userWhere, id: { not: caller.userId, notIn: [...excludedIds, ...boostedIds] } }
    : userWhere

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where: mainWhere,
      select: memberSelect,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sortBy === 'new'
        ? [{ createdAt: 'desc' }, { id: 'asc' }]
        : sortBy === 'verified'
          ? [{ isVerified: 'desc' }, { profile: { lastSeen: 'desc' } }, { id: 'asc' }]
          : [
              { profile: { membershipTier: 'desc' } },
              { profile: { isOnline: 'desc' } },
              { profile: { lastSeen: 'desc' } },
              { id: 'asc' },
            ],
    }),
    db.user.count({ where: userWhere }),
  ])

  const combined = page === 1 ? [...boosted, ...rows] : rows
  const members = combined.map((r) => toMemberResult(r, caller))
  return { members, total, page, limit, callerHasLocation, effectiveCity }
}
