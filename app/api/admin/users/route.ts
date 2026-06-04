import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const sessionUser = session.user as { id: string; role?: string }
    if (sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const search = searchParams.get('search') ?? ''
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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const sessionUser = session.user as { id: string; role?: string }
    if (sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { userId: string; action: 'ban' | 'unban' | 'verify' | 'promote' }
    const { userId, action } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })
    }

    let updateData: Record<string, unknown> = {}
    if (action === 'ban') updateData = { isActive: false }
    else if (action === 'unban') updateData = { isActive: true }
    else if (action === 'verify') updateData = { isVerified: true }
    else if (action === 'promote') updateData = { role: 'ADMIN' }
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
