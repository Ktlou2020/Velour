import { NextRequest, NextResponse } from 'next/server'
import { maybeClaimFounding } from '@/lib/founding'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { deriveCoupleType } from '@/lib/identity'
import { INVITE_TYPE, clearPendingInvitesFor, inviteData, isBlockedEitherWay, isPending, notify } from '../shared'

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

class LinkConflict extends Error {}

/**
 * POST /api/couple/accept { inviteId } (legacy: { notificationId, inviterId })
 * Accepts a pending invitation addressed to the caller and links both
 * profiles (partnerId both ways, isCouple, coupleType from both genders).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return bad('Unauthorized', 401)
    const userId = session.user.id

    const body = await req.json().catch(() => null) as { inviteId?: unknown; notificationId?: unknown; inviterId?: unknown } | null
    const inviteId = typeof body?.inviteId === 'string' ? body.inviteId
      : typeof body?.notificationId === 'string' ? body.notificationId : ''
    const inviterIdHint = typeof body?.inviterId === 'string' ? body.inviterId : ''

    // The invitation must exist, be addressed to the caller and still be pending.
    const invite = inviteId
      ? await db.notification.findFirst({ where: { id: inviteId, userId, type: INVITE_TYPE } })
      : inviterIdHint
        ? (await db.notification.findMany({
            where: { userId, type: INVITE_TYPE, data: { path: ['inviterId'], equals: inviterIdHint } },
            orderBy: { createdAt: 'desc' },
          })).find(isPending) ?? null
        : null
    if (!invite || !isPending(invite)) return bad('This invitation is no longer available', 404)

    const inviterId = inviteData(invite.data).inviterId!
    const inviter = await db.user.findFirst({
      where: { id: inviterId, isActive: true },
      select: { id: true, username: true },
    })
    if (!inviter || inviter.id === userId || await isBlockedEitherWay(userId, inviter.id)) {
      await db.notification.delete({ where: { id: invite.id } }).catch(() => {})
      return bad('This invitation is no longer available', 404)
    }

    try {
      await db.$transaction(async (tx) => {
        const [me, them] = await Promise.all([
          tx.profile.findUnique({ where: { userId }, select: { id: true, partnerId: true, gender: true } }),
          tx.profile.findUnique({ where: { userId: inviter.id }, select: { id: true, partnerId: true, gender: true } }),
        ])
        if (!me || !them) throw new LinkConflict('Profile not found')
        if (me.partnerId) throw new LinkConflict("You're already linked with a partner")
        if (them.partnerId) throw new LinkConflict(`@${inviter.username} is already linked with a partner`)
        const coupleType = deriveCoupleType(me.gender, them.gender)
        await tx.profile.update({ where: { id: me.id }, data: { partnerId: them.id, isCouple: true, coupleType } })
        await tx.profile.update({ where: { id: them.id }, data: { partnerId: me.id, isCouple: true, coupleType } })
        await tx.notification.update({
          where: { id: invite.id },
          data: { isRead: true, data: { ...inviteData(invite.data), status: 'ACCEPTED' } as Prisma.InputJsonValue },
        })
      })
    } catch (err) {
      if (err instanceof LinkConflict) return bad(err.message, 409)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return bad('One of you is already linked with a partner', 409)
      }
      throw err
    }

    // Any other pending invites to/from either of you are now stale.
    await clearPendingInvitesFor([userId, inviter.id])
    const me = await db.user.findUnique({ where: { id: userId }, select: { username: true } })
    await notify(inviter.id, 'Profiles linked', `@${me?.username ?? 'Your partner'} accepted — your profiles are now linked as a couple`, { partnerId: userId })

    // Founding offer: both partners of a newly linked couple are eligible.
    await maybeClaimFounding(userId)
    await maybeClaimFounding(inviter.id)

    return NextResponse.json({ linked: true, partnerUsername: inviter.username })
  } catch (error) {
    console.error('POST /api/couple/accept error:', error)
    return bad('Internal server error', 500)
  }
}
