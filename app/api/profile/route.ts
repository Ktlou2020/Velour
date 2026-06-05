import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        isVerified: true,
        role: true,
        profile: true,
        photos: {
          orderBy: { order: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('GET /api/profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      displayName,
      bio,
      dateOfBirth,
      gender,
      orientation,
      relationshipStatus,
      lookingFor,
      location,
      city,
      country,
    } = body

    const updateData: Record<string, unknown> = {}
    if (displayName !== undefined) updateData.displayName = displayName
    if (bio !== undefined) updateData.bio = bio
    if (dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dateOfBirth)
    if (gender !== undefined) updateData.gender = gender
    if (orientation !== undefined) updateData.orientation = orientation
    if (relationshipStatus !== undefined) updateData.relationshipStatus = relationshipStatus
    if (lookingFor !== undefined) updateData.lookingFor = lookingFor
    if (location !== undefined) updateData.location = location
    if (city !== undefined) updateData.city = city
    if (country !== undefined) updateData.country = country

    // Calculate profile completeness
    const existing = await db.profile.findUnique({
      where: { userId: session.user.id },
    })

    const merged = { ...(existing ?? {}), ...updateData }
    const completenessFields = [
      'displayName', 'bio', 'dateOfBirth', 'gender', 'orientation',
      'relationshipStatus', 'city', 'country', 'profilePhoto',
    ]
    const filled = completenessFields.filter((f) => {
      const val = (merged as Record<string, unknown>)[f]
      return val !== null && val !== undefined
    }).length
    updateData.profileCompleteness = Math.round((filled / completenessFields.length) * 100)

    const profile = await db.profile.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('PUT /api/profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH is the same as PUT — accept both so client calls work regardless of method
export { PUT as PATCH }
