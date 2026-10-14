import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notify, staysCoupleAfterUnlink } from '../shared'

/**
 * POST /api/couple/unlink — either partner can unlink. Both sides are
 * cleared; a profile that signed up as a couple account stays a couple
 * profile, a linked single profile goes back to single.
 */
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const me = await db.profile.findUnique({
      where: { userId },
      select: {
        id: true, partnerId: true, coupleMembers: true, coupleType: true,
        user: { select: { username: true } },
        partner: { select: { id: true, userId: true, coupleMembers: true, coupleType: true } },
      },
    })
    if (!me) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    if (!me.partnerId) return NextResponse.json({ error: "You're not linked with a partner" }, { status: 400 })

    const clear = (members: typeof me.coupleMembers, coupleType: string | null) => {
      const stays = staysCoupleAfterUnlink(members)
      return { partnerId: null, isCouple: stays, coupleType: stays ? coupleType : null }
    }

    await db.$transaction([
      db.profile.update({ where: { id: me.id }, data: clear(me.coupleMembers, me.coupleType) }),
      ...(me.partner ? [db.profile.update({ where: { id: me.partner.id }, data: clear(me.partner.coupleMembers, me.partner.coupleType) })] : []),
    ])

    if (me.partner) {
      await notify(me.partner.userId, 'Profiles unlinked', `@${me.user.username} unlinked your couple profiles`)
    }

    return NextResponse.json({ unlinked: true })
  } catch (error) {
    console.error('POST /api/couple/unlink error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
