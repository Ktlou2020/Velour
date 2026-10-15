import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { todaySpark, validateSparkAnswer } from '@/lib/spark'
import { loadFeed } from './data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/spark — today's question, my answer and the answer count. Other
 * members' answers are only returned once I've answered (give-to-get).
 * Query: ?cursor=<id> for the next page of answers.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cursor = req.nextUrl.searchParams.get('cursor')
    const today = todaySpark()

    const mine = await db.sparkAnswer.findUnique({
      where: { userId_questionId: { userId, questionId: today.key } },
      select: { answer: true },
    })
    const myAnswer = mine?.answer ?? null

    const [feed, count] = await Promise.all([
      myAnswer ? loadFeed(userId, today.key, { cursor }) : Promise.resolve(null),
      db.sparkAnswer.count({ where: { questionId: today.key } }),
    ])

    return NextResponse.json({
      question: today.question,
      dateKey: today.dateKey,
      closesAt: today.closesAt,
      myAnswer,
      count,
      feed: feed ? feed.items : null,
      nextCursor: feed?.nextCursor ?? null,
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
      select: { answer: true },
    })
    return NextResponse.json({ myAnswer: saved.answer })
  } catch (error) {
    console.error('POST /api/spark error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
