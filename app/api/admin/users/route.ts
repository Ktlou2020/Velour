import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { isValidId } from '@/lib/security'
import { db } from '@/lib/db'
import { isSuperAdminEmail } from '@/lib/admin-roles'
import { audit, changeAdminRole } from '@/lib/admin-team'

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await requireAdmin()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.min(10_000, Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1))
    const search = (searchParams.get('search') ?? '').slice(0, 100)
    const adminsOnly = searchParams.get('role') === 'ADMIN'
    const limit = 50
    const skip = (page - 1) * limit

    const where = {
      ...(adminsOnly ? { role: 'ADMIN' } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isDemo: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          profile: {
            select: {
              displayName: true,
              profilePhoto: true,
              membershipTier: true,
              lastSeen: true,
              isOnline: true,
            },
          },
        },
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      users: users.map((u) => ({ ...u, isSuperAdmin: isSuperAdminEmail(u.email) })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      viewerIsSuperAdmin: sessionUser.isSuperAdmin,
    })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireAdmin()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as {
      userId?: unknown
      action?: 'ban' | 'unban' | 'verify' | 'promote' | 'demote' | 'setTier'
      tier?: 'FREE' | 'GOLD' | 'PLATINUM'
    }
    const { userId, action, tier } = body

    if (!isValidId(userId) || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })
    }

    // Guard against an admin locking themselves out.
    if (userId === sessionUser.id && (action === 'ban' || action === 'demote')) {
      return NextResponse.json({ error: 'You cannot ban or demote yourself' }, { status: 400 })
    }

    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const targetIsSuper = isSuperAdminEmail(target.email)

    // Appointing and removing admins is reserved for super admins.
    if (action === 'promote' || action === 'demote') {
      if (!sessionUser.isSuperAdmin) {
        return NextResponse.json({ error: 'Only a super admin can appoint or remove admins' }, { status: 403 })
      }
      const result = await changeAdminRole(sessionUser.id, userId, action === 'promote')
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ user: { ...result.user, isSuperAdmin: false } })
    }

    // Nobody can ban a super admin; only a super admin can ban another admin.
    if (action === 'ban') {
      if (targetIsSuper) {
        return NextResponse.json({ error: 'A super admin cannot be banned' }, { status: 403 })
      }
      if (target.role === 'ADMIN' && !sessionUser.isSuperAdmin) {
        return NextResponse.json({ error: 'Only a super admin can ban another admin' }, { status: 403 })
      }
    }

    if (action === 'setTier') {
      if (!tier || !['FREE', 'GOLD', 'PLATINUM'].includes(tier)) {
        return NextResponse.json({ error: 'Valid tier required: FREE, GOLD, PLATINUM' }, { status: 400 })
      }
      await db.profile.upsert({
        where: { userId },
        update: { membershipTier: tier },
        create: { userId, membershipTier: tier },
      })
      await audit(sessionUser.id, 'TIER_SET', userId, { tier })
      return NextResponse.json({ ok: true })
    }

    let updateData: Record<string, unknown> = {}
    if (action === 'ban') updateData = { isActive: false }
    else if (action === 'unban') updateData = { isActive: true }
    else if (action === 'verify') updateData = { emailVerifiedAt: new Date() }
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, username: true, role: true, isActive: true, isVerified: true },
    })
    if (action === 'ban' || action === 'unban') {
      await audit(sessionUser.id, action === 'ban' ? 'USER_BANNED' : 'USER_UNBANNED', userId, { username: updated.username })
    }

    return NextResponse.json({ user: { ...updated, isSuperAdmin: targetIsSuper } })
  } catch (error) {
    console.error('PATCH /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
