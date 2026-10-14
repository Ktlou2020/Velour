// Server-side Daily Spark helpers (DB access). Not a route file.
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  ageFrom, categoryOf, effectiveInterestedIn, legacyValuesWanting, LEGACY_WHO_VALUES, type Category,
} from '@/lib/identity'
import { parseSparkKey, sparkStreaks, todaySpark, type SparkQuestion } from '@/lib/spark'

export const FEED_PAGE_SIZE = 20

/** Profiles snoozed indefinitely or until a future date are hidden. */
function notSnoozed(now: Date): Prisma.ProfileWhereInput {
  return { NOT: { isSnoozed: true, OR: [{ snoozedUntil: null }, { snoozedUntil: { gt: now } }] } }
}

function categoryWhere(cat: Category): Prisma.ProfileWhereInput {
  if (cat === 'COUPLE') return { isCouple: true }
  if (cat === 'NON_BINARY') return { isCouple: false, gender: { in: ['NON_BINARY', 'OTHER'] } }
  return { isCouple: false, gender: cat }
}

/** Same mutual-interest rule as member search (permissive when preferences are unset). */
function mutualInterest(category: Category | null, interestedIn: Category[]): Prisma.ProfileWhereInput[] {
  const out: Prisma.ProfileWhereInput[] = []
  if (interestedIn.length) {
    out.push({ OR: [...interestedIn.map(categoryWhere), { isCouple: false, gender: null }] })
  }
  if (category) {
    out.push({
      OR: [
        { interestedIn: { has: category } },
        { interestedIn: { isEmpty: true }, lookingFor: { hasSome: legacyValuesWanting(category) } },
        { interestedIn: { isEmpty: true }, NOT: { lookingFor: { hasSome: LEGACY_WHO_VALUES } } },
      ],
    })
  }
  return out
}

/** Ids the viewer has blocked or been blocked by. */
async function blockedIds(userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  return rows.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId))
}

/**
 * Members whose Spark answers the viewer may see: the same people they could
 * find in member search — active, not snoozed, not blocked either way, and
 * mutually interested.
 */
export async function visibleAuthorsWhere(viewerId: string): Promise<Prisma.UserWhereInput> {
  const [me, blocked] = await Promise.all([
    db.profile.findUnique({
      where: { userId: viewerId },
      select: { isCouple: true, gender: true, interestedIn: true, lookingFor: true },
    }),
    blockedIds(viewerId),
  ])
  const category = me ? categoryOf(me) : null
  const interestedIn = me ? effectiveInterestedIn(me) : []
  return {
    id: { not: viewerId, notIn: blocked },
    isActive: true,
    profile: { is: { AND: [notSnoozed(new Date()), ...mutualInterest(category, interestedIn)] } },
  }
}

const authorSelect = {
  username: true,
  profile: {
    select: {
      displayName: true, dateOfBirth: true, city: true, isCouple: true, profilePhoto: true,
      partner: { select: { dateOfBirth: true } },
    },
  },
  photos: { where: { isProfile: true, isPrivate: false }, take: 1, select: { url: true } },
} satisfies Prisma.UserSelect

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>

export interface SparkFeedItem {
  id: string
  username: string
  displayName: string
  age: number | null
  /** Couples: "31 & 34" */
  ageLabel: string | null
  city: string | null
  photoUrl: string | null
  isCouple: boolean
  answer: string
  sameAsMe: boolean
  createdAt: string
}

function toFeedItem(row: { id: string; answer: string; createdAt: Date; user: AuthorRow }, mine: string | null, isPick: boolean): SparkFeedItem {
  const p = row.user.profile
  const age = ageFrom(p?.dateOfBirth) ?? null
  const partnerAge = p?.isCouple ? ageFrom(p.partner?.dateOfBirth) ?? null : null
  return {
    id: row.id,
    username: row.user.username,
    displayName: p?.displayName || row.user.username,
    age,
    ageLabel: age === null ? null : partnerAge !== null ? `${age} & ${partnerAge}` : String(age),
    city: p?.city ?? null,
    photoUrl: row.user.photos[0]?.url ?? p?.profilePhoto ?? null,
    isCouple: !!p?.isCouple,
    answer: row.answer,
    sameAsMe: isPick && mine !== null && row.answer === mine,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function loadFeed(
  viewerId: string,
  key: string,
  question: SparkQuestion,
  myAnswer: string | null,
  opts: { cursor?: string | null; same?: boolean },
): Promise<{ items: SparkFeedItem[]; nextCursor: string | null; total: number; sameCount: number | null }> {
  const userWhere = await visibleAuthorsWhere(viewerId)
  const base: Prisma.SparkAnswerWhereInput = { questionId: key, user: userWhere }
  const isPick = !!question.options
  const where: Prisma.SparkAnswerWhereInput = opts.same && isPick && myAnswer ? { ...base, answer: myAnswer } : base

  const [rows, total, sameCount] = await Promise.all([
    db.sparkAnswer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: FEED_PAGE_SIZE + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: { id: true, answer: true, createdAt: true, user: { select: authorSelect } },
    }),
    db.sparkAnswer.count({ where: base }),
    isPick && myAnswer ? db.sparkAnswer.count({ where: { ...base, answer: myAnswer } }) : Promise.resolve(null),
  ])
  const page = rows.slice(0, FEED_PAGE_SIZE)
  return {
    items: page.map((r) => toFeedItem(r, myAnswer, isPick)),
    nextCursor: rows.length > FEED_PAGE_SIZE ? page[page.length - 1].id : null,
    total,
    sameCount,
  }
}

export interface SparkHistoryItem {
  key: string
  questionId: string
  question: string
  answer: string
  dateKey: string | null
  isPick: boolean
}

/** A member's most recent Spark answers (newest first), with question text. */
export async function loadSparkAnswers(userId: string, take: number, opts: { excludeKey?: string } = {}): Promise<SparkHistoryItem[]> {
  const rows = await db.sparkAnswer.findMany({
    where: { userId, ...(opts.excludeKey ? { NOT: { questionId: opts.excludeKey } } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
    select: { questionId: true, answer: true },
  })
  const out: SparkHistoryItem[] = []
  for (const r of rows) {
    const { question, dateKey } = parseSparkKey(r.questionId)
    if (!question) continue
    out.push({ key: r.questionId, questionId: question.id, question: question.text, answer: r.answer, dateKey: dateKey ?? null, isPick: !!question.options })
  }
  return out
}

/** Current & best streak. One cheap query (keys only). */
export async function loadSparkStreak(userId: string) {
  const rows = await db.sparkAnswer.findMany({ where: { userId }, select: { questionId: true } })
  const days = rows.map((r) => parseSparkKey(r.questionId).dateKey).filter((d): d is string => !!d)
  return sparkStreaks(days)
}

/** Today's question + whether the member has answered (used by nav dot, SparkCard, strength meter). */
export async function loadTodayStatus(userId: string) {
  const today = todaySpark()
  const [mine, count] = await Promise.all([
    db.sparkAnswer.findUnique({ where: { userId_questionId: { userId, questionId: today.key } }, select: { answer: true } }),
    db.sparkAnswer.count({ where: { questionId: today.key } }),
  ])
  return { today, myAnswer: mine?.answer ?? null, count }
}
