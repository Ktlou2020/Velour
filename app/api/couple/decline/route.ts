import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { INVITE_TYPE, inviteData, isPending, notify } from '../shared'

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

/** POST /api/couple/decline { inviteId } — decline an invitation addressed to you. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return bad('Unauthorized', 401)
    const userId = session.user.id
    const body = await req.json().catch(() => null) as { inviteId?: unknown } | null
    const inviteId = typeof body?.inviteId === 'string' ? body.inviteId : ''
    if (!inviteId) return bad('inviteId is required')

    const invite = await db.notification.findFirst({ where: { id: inviteId, userId, type: INVITE_TYPE } })
    if (!invite || !isPending(invite)) return bad('This invitation is no longer available', 404)

    const data = inviteData(invite.data)
    await db.notification.update({
      where: { id: invite.id },
      data: { isRead: true, data: { ...data, status: 'DECLINED' } as Prisma.InputJsonValue },
    })
    if (data.inviterId) {
      const me = await db.user.findUnique({ where: { id: userId }, select: { username: true } })
      await notify(data.inviterId, 'Couple invitation declined', `@${me?.username ?? 'The member'} declined your invitation to link profiles`)
    }
    return NextResponse.json({ declined: true })
  } catch (error) {
    console.error('POST /api/couple/decline error:', error)
    return bad('Internal server error', 500)
  }
}
