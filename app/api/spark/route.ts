import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { todaySpark, validateSparkAnswer } from '@/lib/spark'
import { loadFeed, loadSparkAnswers, loadSparkStreak } from './data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/spark — today's question, my answer, answer count, streak and my
 * recent answers. The feed of other members' answers is only returned once
 * I've answered (give-to-get). Query: ?cursor=<id> for the next page,
 * ?filter=same for quick-pick answers matching mine, ?feedOnly=1 to skip
 * history/streak when paginating.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const cursor = sp.get('cursor')
    const same = sp.get('filter') === 'same'
    const feedOnly = sp.get('feedOnly') === '1'
    const today = todaySpark()

    const mine = await db.sparkAnswer.findUnique({
      where: { userId_questionId: { userId, questionId: today.key } },
      select: { answer: true },
    })
    const myAnswer = mine?.answer ?? null

    const [feed, streak, history, count] = await Promise.all([
      myAnswer ? loadFeed(userId, today.key, today.question, myAnswer, { cursor, same }) : Promise.resolve(null),
      feedOnly ? Promise.resolve(null) : loadSparkStreak(userId),
      feedOnly ? Promise.resolve(null) : loadSparkAnswers(userId, 14, { excludeKey: today.key }),
      db.sparkAnswer.count({ where: { questionId: today.key } }),
    ])

    return NextResponse.json({
      question: today.question,
      dateKey: today.dateKey,
      closesAt: today.closesAt,
      myAnswer,
      count,
      ...(streak ? { streak } : {}),
      ...(history ? { history } : {}),
      feed: feed ? feed.items : null,
      nextCursor: feed?.nextCursor ?? null,
      feedTotal: feed?.total ?? null,
      sameCount: feed?.sameCount ?? null,
    })
  } catch (error) {
    console.error('GET /api/spark error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/spark { answer } — answer today's question; editable until midnight SAST. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!rateLimit(`spark:${userId}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'You’ve edited your Spark a lot — try again a little later.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as { answer?: unknown } | null
    const today = todaySpark()
    const result = validateSparkAnswer(today.question, body?.answer)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

    const saved = await db.sparkAnswer.upsert({
      where: { userId_questionId: { userId, questionId: today.key } },
      create: { userId, questionId: today.key, answer: result.answer },
      update: { answer: result.answer },
      select: { answer: true, createdAt: true },
    })
    const streak = await loadSparkStreak(userId)
    return NextResponse.json({ myAnswer: saved.answer, streak })
  } catch (error) {
    console.error('POST /api/spark error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
