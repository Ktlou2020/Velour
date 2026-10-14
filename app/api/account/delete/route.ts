import { NextRequest, NextResponse } from 'next/server'
import { auth, signOut } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!rateLimit(`account-delete:${userId}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const { confirmation } = await req.json().catch(() => ({})) as { confirmation?: unknown }
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return NextResponse.json({ error: 'Type DELETE MY ACCOUNT to confirm' }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      // Conversations aren't owned by a user, so they'd survive the cascade
      // (with lastMessage previews). Remove every conversation this user was
      // part of; messages and participants cascade from it.
      const convs = await tx.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      })
      if (convs.length > 0) {
        await tx.conversation.deleteMany({ where: { id: { in: convs.map((c) => c.conversationId) } } })
      }

      // Everything else (profile, photos, likes, matches, blocks, messages,
      // notifications, push subscriptions, forum posts, RSVPs, date plans,
      // verification request, OAuth accounts) is onDelete: Cascade.
      await tx.user.delete({ where: { id: userId } })
    })

    // Clear the session cookie. (The session would also be rejected on its
    // next refresh because the user no longer exists.)
    try {
      await signOut({ redirect: false })
    } catch {
      /* client also signs out */
    }

    return NextResponse.json({ ok: true, message: 'Account permanently deleted' })
  } catch (error) {
    console.error('POST /api/account/delete error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
