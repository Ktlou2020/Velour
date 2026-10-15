import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { isSuperAdminEmail } from '@/lib/admin-roles'
import { changeAdminRole } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'

const ROLE_ACTIONS = ['ADMIN_APPOINTED', 'ADMIN_REMOVED', 'USER_BANNED', 'USER_UNBANNED', 'TIER_SET']

/** The admin team and recent admin actions. Any admin may view; only super admins may change it. */
export async function GET() {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const [admins, logs] = await Promise.all([
      db.user.findMany({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, username: true, email: true, isActive: true, createdAt: true,
          profile: { select: { displayName: true, profilePhoto: true, lastSeen: true } },
        },
      }),
      db.adminAuditLog.findMany({
        where: { action: { in: ROLE_ACTIONS } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])
    const ids = [...new Set(logs.flatMap((l) => [l.actorId, l.targetId].filter((x): x is string => !!x)))]
    const people = ids.length
      ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
      : []
    const name = new Map(people.map((p) => [p.id, p.username]))
    const appointedAt = new Map<string, Date>()
    for (const l of [...logs].reverse()) if (l.action === 'ADMIN_APPOINTED' && l.targetId) appointedAt.set(l.targetId, l.createdAt)

    return NextResponse.json({
      viewerIsSuperAdmin: me.isSuperAdmin,
      viewerId: me.id,
      admins: admins.map((a) => ({
        ...a,
        isSuperAdmin: isSuperAdminEmail(a.email),
        appointedAt: appointedAt.get(a.id) ?? null,
      })),
      log: logs.map((l) => ({
        id: l.id,
        action: l.action,
        createdAt: l.createdAt,
        actor: name.get(l.actorId) ?? 'deleted user',
        target: l.targetId ? name.get(l.targetId) ?? ((l.meta as { username?: string } | null)?.username ?? 'deleted user') : null,
        meta: l.meta,
      })),
    })
  } catch (error) {
    console.error('GET /api/admin/team error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Appoint or remove an admin by username, email or user id. Super admins only. */
export async function POST(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!me.isSuperAdmin) {
    return NextResponse.json({ error: 'Only a super admin can appoint or remove admins' }, { status: 403 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { identifier?: unknown; userId?: unknown; action?: unknown }
    const action = body.action
    if (action !== 'appoint' && action !== 'remove') {
      return NextResponse.json({ error: 'action must be appoint or remove' }, { status: 400 })
    }

    let targetId: string | null = null
    if (isValidId(body.userId)) {
      targetId = body.userId
    } else if (typeof body.identifier === 'string' && body.identifier.trim()) {
      const raw = body.identifier.trim().replace(/^@/, '').slice(0, 254)
      const found = await db.user.findFirst({
        where: raw.includes('@')
          ? { email: { equals: raw, mode: 'insensitive' } }
          : { username: { equals: raw, mode: 'insensitive' } },
        select: { id: true },
      })
      if (!found) return NextResponse.json({ error: 'No member found with that username or email' }, { status: 404 })
      targetId = found.id
    } else {
      return NextResponse.json({ error: 'Enter a username or email' }, { status: 400 })
    }

    if (targetId === me.id) {
      return NextResponse.json({ error: 'You cannot change your own admin role' }, { status: 400 })
    }

    const result = await changeAdminRole(me.id, targetId, action === 'appoint')
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ user: result.user })
  } catch (error) {
    console.error('POST /api/admin/team error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
