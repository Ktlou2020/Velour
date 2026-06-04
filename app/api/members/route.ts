import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const rawLimit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    const gender = searchParams.get('gender')
    const minAge = searchParams.get('minAge')
    const maxAge = searchParams.get('maxAge')
    const tier = searchParams.get('tier')
    const lookingFor = searchParams.get('lookingFor')
    const discoverMode = searchParams.get('discover') === '1'

    // Check caller's membership to enforce city restriction
    const callerProfile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { membershipTier: true, city: true },
    })
    const callerRole = (session.user as { role?: string }).role
    const canChangeCity =
      callerRole === 'ADMIN' ||
      callerProfile?.membershipTier === 'GOLD' ||
      callerProfile?.membershipTier === 'PLATINUM'

    // FREE users are locked to their own city regardless of query param
    const requestedCity = searchParams.get('city')
    const city = canChangeCity ? requestedCity : (callerProfile?.city ?? null)

    const effectiveLimit = rawLimit

    const profileWhere: Prisma.ProfileWhereInput = {}

    if (gender) {
      profileWhere.gender = gender as 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER'
    }

    if (city) {
      profileWhere.city = { contains: city, mode: 'insensitive' }
    }

    if (tier) {
      profileWhere.membershipTier = tier as 'FREE' | 'GOLD' | 'PLATINUM'
    }

    if (lookingFor) {
      profileWhere.lookingFor = { has: lookingFor }
    }

    if (minAge || maxAge) {
      const now = new Date()
      if (maxAge) {
        const minDob = new Date(now)
        minDob.setFullYear(minDob.getFullYear() - parseInt(maxAge, 10) - 1)
        profileWhere.dateOfBirth = {
          ...((profileWhere.dateOfBirth as object) ?? {}),
          gte: minDob,
        }
      }
      if (minAge) {
        const maxDob = new Date(now)
        maxDob.setFullYear(maxDob.getFullYear() - parseInt(minAge, 10))
        profileWhere.dateOfBirth = {
          ...((profileWhere.dateOfBirth as object) ?? {}),
          lte: maxDob,
        }
      }
    }

    const skip = (page - 1) * effectiveLimit

    // Collect block relationships
    const blocks = await db.block.findMany({
      where: {
        OR: [
          { blockerId: session.user.id },
          { blockedId: session.user.id },
        ],
      },
      select: { blockerId: true, blockedId: true },
    })

    const currentUserId = session.user.id
    const excludedIds = blocks.map((b) =>
      b.blockerId === currentUserId ? b.blockedId : b.blockerId
    )

    // In discover mode, exclude already-liked/passed-within-5-days profiles
    if (discoverMode) {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      const existingActions = await db.like.findMany({
        where: {
          fromUserId: currentUserId,
          OR: [
            { type: { not: 'PASS' } },
            { type: 'PASS', createdAt: { gte: fiveDaysAgo } },
          ],
        },
        select: { toUserId: true },
      })
      excludedIds.push(...existingActions.map((l) => l.toUserId))
    }

    const users = await db.user.findMany({
      where: {
        id: { not: session.user.id, notIn: excludedIds },
        isActive: true,
        profile: profileWhere,
      },
      select: {
        id: true,
        username: true,
        isVerified: true,
        profile: {
          select: {
            displayName: true,
            profilePhoto: true,
            city: true,
            country: true,
            gender: true,
            orientation: true,
            lookingFor: true,
            membershipTier: true,
            isOnline: true,
            lastSeen: true,
            dateOfBirth: true,
            bio: true,
          },
        },
        photos: {
          where: { isProfile: true, isPrivate: false },
          take: 1,
          select: { url: true, thumbnailUrl: true },
        },
      },
      skip,
      take: effectiveLimit,
      orderBy: [{ profile: { isOnline: 'desc' } }, { profile: { lastSeen: 'desc' } }],
    })

    const total = await db.user.count({
      where: {
        id: { not: session.user.id, notIn: excludedIds },
        isActive: true,
        profile: profileWhere,
      },
    })

    const members = discoverMode
      ? users.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.profile?.displayName,
          age: u.profile?.dateOfBirth
            ? Math.floor((Date.now() - new Date(u.profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : undefined,
          city: u.profile?.city,
          country: u.profile?.country,
          bio: u.profile?.bio,
          interests: [],
          profilePhotoUrl: u.photos[0]?.url ?? u.profile?.profilePhoto ?? null,
          isOnline: u.profile?.isOnline,
          membershipTier: u.profile?.membershipTier,
        }))
      : users

    return NextResponse.json({
      members,
      pagination: {
        page,
        limit: effectiveLimit,
        total,
        pages: Math.ceil(total / effectiveLimit),
      },
    })
  } catch (error) {
    console.error('GET /api/members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
