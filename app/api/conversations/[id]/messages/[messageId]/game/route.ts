import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getConversationAccess, getCoupleMemberNames, getPartnerMap, sideOf } from '@/lib/couples'
import { MAX_ANSWER_TEXT, parseGameMeta, redactGameMeta } from '@/lib/chat-games'

/**
 * POST { answer, as? } — play a GAME message.
 *   This or That / Would you rather: answer = 0 | 1
 *   Two truths and a lie:            answer = 0 | 1 | 2 (your guess for the lie)
 *   21 Questions:                    answer = text (≤ 300 chars)
 * One answer per account (a shared couple account names who answered via
 * `as`). The sender can't guess their own Two truths. Returns the game as the
 * caller now sees it (everything revealed once they've played).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id
    const { id: conversationId, messageId } = await params
    const body = await req.json().catch(() => ({})) as { answer?: unknown; as?: unknown }

    const access = await getConversationAccess(conversationId, userId)
    if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (access.blocked) return NextResponse.json({ error: 'You can no longer play in this conversation' }, { status: 403 })

    let as: string | null = null
    if (typeof body.as === 'string' && body.as.trim()) {
      const p = await db.profile.findUnique({ where: { userId }, select: { isCouple: true, partnerId: true, coupleMembers: true } })
      const names = p?.isCouple && !p.partnerId ? getCoupleMemberNames(p.coupleMembers) : []
      if (!names.includes(body.as.trim())) return NextResponse.json({ error: 'Choose who is answering' }, { status: 400 })
      as = body.as.trim()
    }

    const result = await db.$transaction(async (tx) => {
      // Row lock so two players answering at once don't overwrite each other
      await tx.$queryRaw`SELECT id FROM "Message" WHERE id = ${messageId} FOR UPDATE`
      const msg = await tx.message.findFirst({
        where: { id: messageId, conversationId, kind: 'GAME' },
        select: { senderId: true, meta: true },
      })
      if (!msg) return { status: 404, error: 'Game not found' } as const
      const meta = parseGameMeta(msg.meta)
      if (!meta) return { status: 404, error: 'Game not found' } as const
      if (meta.answers[userId]) return { status: 409, error: 'You already played this one' } as const

      const at = new Date().toISOString()
      if (meta.game === 'questions') {
        const text = typeof body.answer === 'string' ? body.answer.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : ''
        if (!text) return { status: 400, error: 'Write an answer' } as const
        if (text.length > MAX_ANSWER_TEXT) return { status: 400, error: `Answers must be under ${MAX_ANSWER_TEXT} characters` } as const
        meta.answers[userId] = { text, as, at }
      } else {
        if (meta.game === 'two_truths' && msg.senderId === userId) {
          return { status: 400, error: "You can't guess your own lie" } as const
        }
        const n = meta.options?.length ?? 0
        if (typeof body.answer !== 'number' || !Number.isInteger(body.answer) || body.answer < 0 || body.answer >= n) {
          return { status: 400, error: 'Pick one of the options' } as const
        }
        meta.answers[userId] = { choice: body.answer, as, at }
      }

      await tx.message.update({ where: { id: messageId }, data: { meta: meta as unknown as Prisma.InputJsonValue } })
      // Touch the conversation so every participant's SSE stream picks it up
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
      return { status: 200, senderId: msg.senderId, meta } as const
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    const side = sideOf(userId, await getPartnerMap(access.userIds))
    return NextResponse.json({ messageId, meta: redactGameMeta(result.meta, result.senderId, userId, side) })
  } catch (error) {
    console.error('POST game answer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
