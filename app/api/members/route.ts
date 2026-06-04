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
    const city = searchParams.get('city')
    const tier = searchParams.get('tier')
    const lookingFor = searchParams.get('lookingFor')

    // FREE tier: cap at 20 results total
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

    const users = await db.user.findMany({
      where: {
        id: { not: session.user.id },
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
        id: { not: session.user.id },
        isActive: true,
        profile: profileWhere,
      },
    })

    return NextResponse.json({
      members: users,
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
