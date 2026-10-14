/**
 * Profile badges — computed on the fly from existing data (no schema).
 *
 * `evaluateBadges()` is pure; `loadBadges()` gathers the facts with one
 * aggregate SQL query plus two small lookups. Client components should only
 * `import type` from here.
 */
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { completenessOf, parseCoupleMembers } from '@/lib/identity'
import { profileStrength } from '@/app/profile/strength'
import { parsePrompts, MAX_PROMPTS } from '@/app/profile/prompts'
import { loadSparkStreak } from '@/app/api/spark/data'

export interface Badge {
  id: string
  label: string
  emoji: string
  description: string
  earned: boolean
  /** For unearned badges with a measurable goal, e.g. 2 / 3 photos. */
  progress?: { current: number; target: number }
  /** Where to go to earn it (own profile only). */
  href?: string
}

export interface BadgeFacts {
  isVerified: boolean
  createdAt: Date
  isCouple: boolean
  coupleLinked: boolean
  publicPhotos: number
  bestSparkStreak: number
  conversationsStarted: number
  eventsAttended: number
  prompts: number
  /** Profile strength % (same score as the meter on the profile page). */
  completeness: number
}

/** Accounts created before this date are founding members (first ~90 days). */
export const FOUNDING_CUTOFF = new Date('2027-01-15T00:00:00+02:00')

const clampProgress = (current: number, target: number) => ({ current: Math.min(current, target), target })

export function evaluateBadges(f: BadgeFacts): Badge[] {
  const spark = (days: number, id: string, label: string, emoji: string): Badge => ({
    id, label, emoji,
    description: `Answered the Daily Spark ${days} days in a row`,
    earned: f.bestSparkStreak >= days,
    progress: clampProgress(f.bestSparkStreak, days),
    href: '/spark',
  })
  const badges: Badge[] = [
    {
      id: 'verified', label: 'Verified', emoji: '🛡️',
      description: 'Passed a quick selfie check',
      earned: f.isVerified, href: '/account',
    },
    {
      id: 'profile_complete', label: 'Profile complete', emoji: '✅',
      description: 'Profile strength at 100%',
      earned: f.completeness >= 100, progress: clampProgress(f.completeness, 100), href: '/profile#strength',
    },
    {
      id: 'founding', label: 'Founding member', emoji: '🌱',
      description: 'Joined Hush in its first months',
      earned: f.createdAt < FOUNDING_CUTOFF,
    },
    ...(f.isCouple
      ? [{
          id: 'couple_linked', label: 'Couple linked', emoji: '💞',
          description: 'Both partners’ accounts are linked',
          earned: f.coupleLinked, href: '/profile#couple-link',
        }]
      : []),
    {
      id: 'storyteller', label: 'Storyteller', emoji: '📖',
      description: `Answered all ${MAX_PROMPTS} profile prompts`,
      earned: f.prompts >= MAX_PROMPTS, progress: clampProgress(f.prompts, MAX_PROMPTS), href: '/profile#prompts',
    },
    {
      id: 'photo_ready', label: 'Photo-ready', emoji: '📸',
      description: '3 or more public photos',
      earned: f.publicPhotos >= 3, progress: clampProgress(f.publicPhotos, 3), href: '/profile#photos',
    },
    spark(3, 'spark_3', 'Spark streak', '🔥'),
    spark(7, 'spark_7', 'Spark regular', '✨'),
    spark(30, 'spark_30', 'Spark devotee', '💫'),
    {
      id: 'conversation_starter', label: 'Conversation starter', emoji: '💬',
      description: 'Said hello first in 10 conversations',
      earned: f.conversationsStarted >= 10, progress: clampProgress(f.conversationsStarted, 10), href: '/members',
    },
    {
      id: 'event_goer', label: 'Event-goer', emoji: '🎟️',
      description: 'Went to a Hush event',
      earned: f.eventsAttended >= 1, progress: clampProgress(f.eventsAttended, 1), href: '/events',
    },
  ]
  // Progress is only interesting while unearned.
  return badges.map((b) => (b.earned ? { ...b, progress: undefined } : b))
}

/**
 * Earned badges for display on a member's profile: the highest Spark tier
 * only, so the row stays meaningful.
 */
export function earnedForDisplay(badges: Badge[]): Badge[] {
  const earned = badges.filter((b) => b.earned)
  const sparkIds = ['spark_30', 'spark_7', 'spark_3']
  const topSpark = sparkIds.find((id) => earned.some((b) => b.id === id))
  return earned.filter((b) => !sparkIds.includes(b.id) || b.id === topSpark)
}

interface CountsRow {
  publicPhotos: number
  mainPhotos: number
  conversationsStarted: number
  eventsAttended: number
}

export async function loadBadgeFacts(userId: string): Promise<BadgeFacts | null> {
  const [user, counts, streak] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        isVerified: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true, bio: true, dateOfBirth: true, gender: true, orientation: true,
            interestedIn: true, lookingFor: true, city: true, country: true, profilePhoto: true,
            isCouple: true, partnerId: true, prompts: true,
            intentions: true, pronouns: true, coupleMembers: true,
          },
        },
      },
    }),
    db.$queryRaw<CountsRow[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM "Photo" ph LEFT JOIN "Album" a ON a."id" = ph."albumId"
          WHERE ph."userId" = ${userId} AND ph."isPrivate" = false
            AND (ph."albumId" IS NULL OR left(a."name", 2) <> '__'))::int AS "publicPhotos",
        (SELECT COUNT(*) FROM "Photo" ph WHERE ph."userId" = ${userId} AND ph."isProfile" = true)::int AS "mainPhotos",
        (SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (m."conversationId") m."senderId"
          FROM "Message" m
          WHERE m."conversationId" IN (SELECT cp."conversationId" FROM "ConversationParticipant" cp WHERE cp."userId" = ${userId})
          ORDER BY m."conversationId", m."createdAt" ASC
        ) firsts WHERE firsts."senderId" = ${userId})::int AS "conversationsStarted",
        (SELECT COUNT(*) FROM "EventAttendee" ea JOIN "Event" e ON e."id" = ea."eventId"
          WHERE ea."userId" = ${userId} AND ea."status" = 'GOING'
            AND COALESCE(e."endDate", e."date") < NOW())::int AS "eventsAttended"
    `),
    loadSparkStreak(userId),
  ])
  if (!user) return null
  const c = counts[0] ?? { publicPhotos: 0, mainPhotos: 0, conversationsStarted: 0, eventsAttended: 0 }
  const p = user.profile
  return {
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    isCouple: !!p?.isCouple,
    coupleLinked: !!p?.partnerId,
    publicPhotos: Number(c.publicPhotos) || 0,
    bestSparkStreak: streak.best,
    conversationsStarted: Number(c.conversationsStarted) || 0,
    eventsAttended: Number(c.eventsAttended) || 0,
    prompts: parsePrompts(p?.prompts).length,
    completeness: profileStrength({
      missing: completenessOf(p, Number(c.mainPhotos) > 0).missing,
      publicPhotos: Number(c.publicPhotos) || 0,
      prompts: parsePrompts(p?.prompts).length,
      hasIntentions: (p?.intentions?.length ?? 0) > 0,
      isCouple: !!p?.isCouple,
      hasPersonalTouch: p?.isCouple ? (!!p.partnerId || parseCoupleMembers(p.coupleMembers).length > 1) : !!p?.pronouns,
      sparkAnsweredToday: true,
    }).percent,
  }
}

export async function loadBadges(userId: string): Promise<Badge[]> {
  const facts = await loadBadgeFacts(userId)
  return facts ? evaluateBadges(facts) : []
}
