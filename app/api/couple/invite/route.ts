import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { sendPushToUser } from '@/lib/push'
import {
  INVITE_TYPE, healOrphanedCouple, incomingInvites, inviteData, isBlockedEitherWay, isPending, outgoingInvites,
} from '../shared'

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

const NOT_FOUND = "We couldn't find a member with that username"

/**
 * GET /api/couple/invite — the caller's couple state: linked partner (if any),
 * pending invitations received and sent.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return bad('Unauthorized', 401)
    const userId = session.user.id
    await healOrphanedCouple(userId)

    const [me, incoming, outgoing] = await Promise.all([
      db.profile.findUnique({
        where: { userId },
        select: {
          isCouple: true,
          partner: { select: { displayName: true, profilePhoto: true, user: { select: { id: true, username: true } } } },
        },
      }),
      incomingInvites(userId),
      outgoingInvites(userId),
    ])

    // Only show invites from members who still exist, are active and aren't blocked.
    const inviterIds = Array.from(new Set(incoming.map((n) => inviteData(n.data).inviterId!).filter(Boolean)))
    const inviteeIds = Array.from(new Set(outgoing.map((n) => n.userId)))
    const [people, blocks] = await Promise.all([
      db.user.findMany({
        where: { id: { in: [...inviterIds, ...inviteeIds] }, isActive: true },
        select: { id: true, username: true, profile: { select: { displayName: true, partnerId: true } } },
      }),
      db.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ])
    const blocked = new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)))
    const byId = new Map(people.map((p) => [p.id, p]))

    return NextResponse.json({
      partner: me?.partner?.user
        ? { username: me.partner.user.username, displayName: me.partner.displayName, profilePhoto: me.partner.profilePhoto }
        : null,
      incoming: incoming.flatMap((n) => {
        const id = inviteData(n.data).inviterId!
        const u = byId.get(id)
        if (!u || blocked.has(id) || u.profile?.partnerId) return []
        return [{ id: n.id, inviterId: id, username: u.username, displayName: u.profile?.displayName ?? null, createdAt: n.createdAt }]
      }),
      outgoing: outgoing.flatMap((n) => {
        const u = byId.get(n.userId)
        if (!u || blocked.has(n.userId)) return []
        return [{ id: n.id, username: u.username, displayName: u.profile?.displayName ?? null, createdAt: n.createdAt }]
      }),
    })
  } catch (error) {
    console.error('GET /api/couple/invite error:', error)
    return bad('Internal server error', 500)
  }
}

/** POST /api/couple/invite { partnerUsername } — invite another member to link profiles. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return bad('Unauthorized', 401)
    const userId = session.user.id

    if (!rateLimit(`couple-invite:${userId}`, 10, 60 * 60 * 1000)) {
      return bad('Too many invitations — please try again later', 429)
    }

    const body = await req.json().catch(() => null) as { partnerUsername?: unknown } | null
    const partnerUsername = typeof body?.partnerUsername === 'string'
      ? body.partnerUsername.trim().replace(/^@/, '').slice(0, 30)
      : ''
    if (!partnerUsername) return bad("Please enter your partner's username")

    const [me, partner] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profile: { select: { id: true, partnerId: true } } },
      }),
      db.user.findFirst({
        where: { username: { equals: partnerUsername, mode: 'insensitive' }, isActive: true },
        select: { id: true, username: true, profile: { select: { id: true, partnerId: true } } },
      }),
    ])
    if (!me?.profile) return bad('Please finish setting up your profile first', 400)
    if (!partner?.profile) return bad(NOT_FOUND, 404)
    if (partner.id === me.id) return bad("You can't invite yourself")
    // Don't reveal blocks: behave as if the member doesn't exist.
    if (await isBlockedEitherWay(me.id, partner.id)) return bad(NOT_FOUND, 404)
    if (me.profile.partnerId) return bad("You're already linked with a partner. Unlink first to invite someone else.", 409)
    if (partner.profile.partnerId) return bad(`@${partner.username} is already linked with a partner`, 409)

    // Already invited them? Don't send a duplicate.
    const mine = await outgoingInvites(me.id)
    if (mine.some((n) => n.userId === partner.id)) {
      return NextResponse.json({ sent: true, alreadyPending: true })
    }
    // They already invited you? Point you at accepting instead.
    const theirs = await db.notification.findMany({
      where: { userId: me.id, type: INVITE_TYPE, data: { path: ['inviterId'], equals: partner.id } },
      select: { isRead: true, data: true },
    })
    if (theirs.some(isPending)) {
      return bad(`@${partner.username} has already invited you — accept their invitation below`, 409)
    }

    await db.notification.create({
      data: {
        userId: partner.id,
        type: INVITE_TYPE,
        title: 'Couple invitation',
        body: `@${me.username} would like to link profiles with you as a couple`,
        data: { inviterId: me.id, inviterUsername: me.username, status: 'PENDING' },
      },
    })
    sendPushToUser(partner.id, {
      title: 'Couple invitation',
      body: `@${me.username} would like to link profiles with you`,
      url: '/profile#couple',
      tag: `couple-invite-${me.id}`,
    }).catch(() => {})

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('POST /api/couple/invite error:', error)
    return bad('Internal server error', 500)
  }
}

/** DELETE /api/couple/invite { inviteId } — cancel an invitation you sent. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return bad('Unauthorized', 401)
    const body = await req.json().catch(() => null) as { inviteId?: unknown } | null
    const inviteId = typeof body?.inviteId === 'string' ? body.inviteId : ''
    if (!inviteId) return bad('inviteId is required')

    const n = await db.notification.findUnique({ where: { id: inviteId } })
    if (!n || n.type !== INVITE_TYPE || inviteData(n.data).inviterId !== session.user.id || !isPending(n)) {
      return bad('Invitation not found', 404)
    }
    await db.notification.delete({ where: { id: n.id } })
    return NextResponse.json({ cancelled: true })
  } catch (error) {
    console.error('DELETE /api/couple/invite error:', error)
    return bad('Internal server error', 500)
  }
}
