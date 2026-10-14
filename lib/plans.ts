/**
 * Membership plans — the single source of truth for what each tier gets.
 *
 * Server code must check entitlements here (never compare tier strings
 * inline), and the upgrade/subscription pages render their comparison from
 * PLAN_FEATURES so marketing copy can't drift from what the code enforces.
 */
import type { MembershipTier } from '@prisma/client'

export type PlanTier = 'FREE' | 'GOLD' | 'PLATINUM'

export interface Entitlements {
  /** Messages a member can send in any rolling 24 hours; null = unlimited. */
  messagesPer24h: number | null
  /** Chat media (photos, videos, voice notes) a member can send in any rolling 24 hours; null = unlimited. */
  chatMediaPer24h: number | null
  /** Longest video that can be sent in chat, in seconds. */
  chatVideoMaxSec: number
  /** Likes (incl. winks) per calendar day (SAST); null = unlimited. */
  likesPerDay: number | null
  /** Super likes granted per day (free) or week (paid) — see superLikePeriod. */
  superLikes: number
  superLikePeriod: 'day' | 'week'
  /** Priority messages (pinned to the top of the recipient's inbox) per week; null = unlimited. */
  priorityMessagesPerWeek: number | null
  dailyPicks: number
  /** Private albums a member can own; null = unlimited. */
  privateAlbums: number | null
  seeWhoLikedYou: boolean
  seeWhoViewedYou: boolean
  readReceipts: boolean
  undoSwipe: boolean
  advancedFilters: boolean
  /** "Anywhere" search (no distance limit) and the city text filter. */
  searchAnyCity: boolean
  /** Largest search radius in km from the member's location; null = Anywhere. */
  maxSearchRadiusKm: number | null
  travelMode: boolean
  /** Boost cooldown in days; null = no boosts. */
  boostEveryDays: number | null
  priorityInSearch: boolean
  incognito: boolean
  videoProfile: boolean
  compatibilityInsights: boolean
  spotlight: boolean
  profileInsights: boolean
  forumPosting: boolean
  createEvents: boolean
  voiceNotes: boolean
  chatGames: boolean
}

export const PLANS: Record<PlanTier, Entitlements> = {
  FREE: {
    messagesPer24h: 5,
    chatMediaPer24h: null,
    chatVideoMaxSec: 5,
    likesPerDay: 50,
    superLikes: 1,
    superLikePeriod: 'day',
    priorityMessagesPerWeek: 0,
    dailyPicks: 5,
    privateAlbums: 1,
    seeWhoLikedYou: false,
    seeWhoViewedYou: false,
    readReceipts: false,
    undoSwipe: false,
    advancedFilters: false,
    searchAnyCity: false,
    maxSearchRadiusKm: 250,
    travelMode: false,
    boostEveryDays: null,
    priorityInSearch: false,
    incognito: false,
    videoProfile: false,
    compatibilityInsights: false,
    spotlight: false,
    profileInsights: false,
    forumPosting: true,
    createEvents: false,
    voiceNotes: true,
    chatGames: true,
  },
  GOLD: {
    messagesPer24h: null,
    chatMediaPer24h: null,
    chatVideoMaxSec: 60,
    likesPerDay: null,
    superLikes: 5,
    superLikePeriod: 'week',
    priorityMessagesPerWeek: 3,
    dailyPicks: 10,
    privateAlbums: null,
    seeWhoLikedYou: true,
    seeWhoViewedYou: true,
    readReceipts: true,
    undoSwipe: true,
    advancedFilters: true,
    searchAnyCity: true,
    maxSearchRadiusKm: null,
    travelMode: true,
    boostEveryDays: 30,
    priorityInSearch: true,
    incognito: false,
    videoProfile: false,
    compatibilityInsights: false,
    spotlight: false,
    profileInsights: false,
    forumPosting: true,
    createEvents: true,
    voiceNotes: true,
    chatGames: true,
  },
  PLATINUM: {
    messagesPer24h: null,
    chatMediaPer24h: null,
    chatVideoMaxSec: 180,
    likesPerDay: null,
    superLikes: 10,
    superLikePeriod: 'week',
    priorityMessagesPerWeek: null,
    dailyPicks: 15,
    privateAlbums: null,
    seeWhoLikedYou: true,
    seeWhoViewedYou: true,
    readReceipts: true,
    undoSwipe: true,
    advancedFilters: true,
    searchAnyCity: true,
    maxSearchRadiusKm: null,
    travelMode: true,
    boostEveryDays: 7,
    priorityInSearch: true,
    incognito: true,
    videoProfile: true,
    compatibilityInsights: true,
    spotlight: true,
    profileInsights: true,
    forumPosting: true,
    createEvents: true,
    voiceNotes: true,
    chatGames: true,
  },
}

/** New members send chat media without limits for their first 3 days, whatever their plan. */
export const NEW_MEMBER_UNLIMITED_MESSAGES_DAYS = 3
export const NEW_MEMBER_UNLIMITED_MEDIA_DAYS = NEW_MEMBER_UNLIMITED_MESSAGES_DAYS

/**
 * Effective rolling-24h message limit for a member: null (unlimited) for paid
 * plans, admins, and members whose account is younger than
 * NEW_MEMBER_UNLIMITED_MESSAGES_DAYS; otherwise the plan's messagesPer24h.
 */
export function messageLimitFor(
  tier: MembershipTier | PlanTier | null | undefined,
  role: string | null | undefined,
  accountCreatedAt: Date | string,
  now = new Date(),
): { limit: number | null; welcomeUntil: Date | null } {
  const base = entitlements(tier, role).messagesPer24h
  if (base === null) return { limit: null, welcomeUntil: null }
  const welcomeUntil = new Date(new Date(accountCreatedAt).getTime() + NEW_MEMBER_UNLIMITED_MESSAGES_DAYS * 24 * 60 * 60 * 1000)
  if (welcomeUntil.getTime() > now.getTime()) return { limit: null, welcomeUntil }
  return { limit: base, welcomeUntil: null }
}

/**
 * Effective rolling-24h chat media limit (photos, videos, voice notes): null
 * (unlimited) for paid plans, admins, and members in their first
 * NEW_MEMBER_UNLIMITED_MEDIA_DAYS; otherwise the plan's chatMediaPer24h.
 */
export function mediaLimitFor(
  tier: MembershipTier | PlanTier | null | undefined,
  role: string | null | undefined,
  accountCreatedAt: Date | string,
  now = new Date(),
): { limit: number | null; welcomeUntil: Date | null } {
  const base = entitlements(tier, role).chatMediaPer24h
  if (base === null) return { limit: null, welcomeUntil: null }
  const welcomeUntil = new Date(new Date(accountCreatedAt).getTime() + NEW_MEMBER_UNLIMITED_MEDIA_DAYS * 24 * 60 * 60 * 1000)
  if (welcomeUntil.getTime() > now.getTime()) return { limit: null, welcomeUntil }
  return { limit: base, welcomeUntil: null }
}

/** Admins get everything Platinum has. */
export function planFor(tier: MembershipTier | PlanTier | null | undefined, role?: string | null): PlanTier {
  if (role === 'ADMIN') return 'PLATINUM'
  return tier === 'GOLD' || tier === 'PLATINUM' ? tier : 'FREE'
}

export function entitlements(tier: MembershipTier | PlanTier | null | undefined, role?: string | null): Entitlements {
  return PLANS[planFor(tier, role)]
}

/** Start of "today" in South African time (UTC+2, no DST), as a UTC Date. */
export function startOfDaySAST(now = new Date()): Date {
  const offsetMs = 2 * 60 * 60 * 1000
  const local = new Date(now.getTime() + offsetMs)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - offsetMs)
}

/** Start of the current week (Monday 00:00 SAST), as a UTC Date. */
export function startOfWeekSAST(now = new Date()): Date {
  const day = startOfDaySAST(now)
  const offsetMs = 2 * 60 * 60 * 1000
  const weekday = new Date(day.getTime() + offsetMs).getUTCDay() // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7
  return new Date(day.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000)
}

/**
 * Feature comparison for the upgrade/subscription pages. `values` are per tier:
 * true/false for a tick/cross, or a short string such as "50 / day".
 */
export const PLAN_FEATURES: { group: string; items: { label: string; values: Record<PlanTier, boolean | string> }[] }[] = [
  {
    group: 'Meet people',
    items: [
      { label: 'Browse members & discover', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Likes', values: { FREE: '50 / day', GOLD: 'Unlimited', PLATINUM: 'Unlimited' } },
      { label: 'Super likes', values: { FREE: '1 / day', GOLD: '5 / week', PLATINUM: '10 / week' } },
      { label: "Today's picks", values: { FREE: '5', GOLD: '10', PLATINUM: '15' } },
      { label: 'Daily Spark question & answers', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Distance search near you', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Search radius', values: { FREE: 'Up to 250 km', GOLD: 'Anywhere', PLATINUM: 'Anywhere' } },
      { label: 'Travel mode', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'Advanced filters', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'Undo last swipe', values: { FREE: false, GOLD: true, PLATINUM: true } },
    ],
  },
  {
    group: 'Chat',
    items: [
      { label: 'Messages you can send (text, photos, videos, voice notes)', values: { FREE: 'Unlimited for 3 days, then 5 / 24 hours', GOLD: 'Unlimited', PLATINUM: 'Unlimited' } },
      { label: 'Reactions & receiving messages', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Video length in chat', values: { FREE: '5 sec', GOLD: '60 sec', PLATINUM: '3 min' } },
      { label: 'Chat games & icebreakers', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Read receipts', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'Priority messages', values: { FREE: false, GOLD: '3 / week', PLATINUM: 'Unlimited' } },
    ],
  },
  {
    group: 'Your profile',
    items: [
      { label: 'Photo gallery & albums', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Private albums', values: { FREE: '1', GOLD: 'Unlimited', PLATINUM: 'Unlimited' } },
      { label: 'Status, badges & profile strength', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Reviews & trust score', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'See who liked you', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'See who viewed you', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'Profile boost', values: { FREE: false, GOLD: 'Monthly', PLATINUM: 'Weekly' } },
      { label: 'Priority in search', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'Spotlight in discover', values: { FREE: false, GOLD: false, PLATINUM: true } },
      { label: 'Incognito browsing', values: { FREE: false, GOLD: false, PLATINUM: true } },
      { label: 'Video profile', values: { FREE: false, GOLD: false, PLATINUM: true } },
      { label: 'Compatibility insights', values: { FREE: false, GOLD: false, PLATINUM: true } },
      { label: 'Profile insights dashboard', values: { FREE: false, GOLD: false, PLATINUM: true } },
    ],
  },
  {
    group: 'Community',
    items: [
      { label: 'Forums: read & post', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Events: browse & RSVP', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Host events', values: { FREE: false, GOLD: true, PLATINUM: true } },
      { label: 'Couples: link partners & shared chats', values: { FREE: true, GOLD: true, PLATINUM: true } },
      { label: 'Safety centre & Share my date', values: { FREE: true, GOLD: true, PLATINUM: true } },
    ],
  },
]
