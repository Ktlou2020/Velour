import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { REACTION_EMOJIS, normalizeReactions } from '@/lib/reactions'

/** POST { emoji } — toggles the caller's reaction on a message. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const { id: conversationId, messageId } = await params
    const body = await req.json().catch(() => ({})) as { emoji?: unknown }
    const emoji = body.emoji
    if (typeof emoji !== 'string' || !(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      return NextResponse.json({ error: 'Unsupported reaction' }, { status: 400 })
    }

    const participant = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const reactions = await db.$transaction(async (tx) => {
      const message = await tx.message.findFirst({
        where: { id: messageId, conversationId },
        select: { reactions: true },
      })
      if (!message) return null

      const current = normalizeReactions(message.reactions)
      const users = current[emoji] ?? []
      const next = users.includes(userId) ? users.filter((u) => u !== userId) : [...users, userId]
      if (next.length > 0) current[emoji] = next
      else delete current[emoji]

      const empty = Object.keys(current).length === 0
      await tx.message.update({
        where: { id: messageId },
        data: { reactions: empty ? Prisma.DbNull : current },
      })
      // Touch the conversation so participants' SSE streams pick up the change
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })
      return current
    })

    if (!reactions) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    return NextResponse.json({ messageId, reactions })
  } catch (error) {
    console.error('POST react error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
