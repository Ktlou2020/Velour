import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { isValidId } from '@/lib/security'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await requireAdmin()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.min(10_000, Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1))
    const search = (searchParams.get('search') ?? '').slice(0, 100)
    const limit = 50
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

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

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) })
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

    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
      return NextResponse.json({ ok: true })
    }

    let updateData: Record<string, unknown> = {}
    if (action === 'ban') updateData = { isActive: false }
    else if (action === 'unban') updateData = { isActive: true }
    else if (action === 'verify') updateData = { isVerified: true }
    else if (action === 'promote') updateData = { role: 'ADMIN' }
    else if (action === 'demote') updateData = { role: 'USER' }
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, username: true, role: true, isActive: true, isVerified: true },
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error('PATCH /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
