import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isPlatinum } from '@/lib/premium'
import { validatePrompts } from '@/app/profile/prompts'

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

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

    const needsTierCheck =
      body.incognito === true || (typeof body.videoUrl === 'string' && body.videoUrl !== '')
    let platinum = false
    if (needsTierCheck) {
      const u = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
      platinum = isPlatinum(existing?.membershipTier, u?.role)
    }

    // Profile prompts
    if (body.prompts !== undefined) {
      const result = validatePrompts(body.prompts)
      if ('error' in result) return bad(result.error)
      updateData.prompts = result.prompts
    }

    // Incognito (Platinum only to enable; anyone may disable)
    if (body.incognito !== undefined) {
      if (typeof body.incognito !== 'boolean') return bad('incognito must be true or false')
      if (body.incognito && !platinum) return bad('Incognito mode is a Platinum feature', 403)
      updateData.incognito = body.incognito
    }

    // Show chat images without blurring
    if (body.showChatImages !== undefined) {
      if (typeof body.showChatImages !== 'boolean') return bad('showChatImages must be true or false')
      updateData.showChatImages = body.showChatImages
    }

    // Video profile (Platinum only to set; anyone may remove)
    if (body.videoUrl !== undefined) {
      if (body.videoUrl === null || body.videoUrl === '') {
        updateData.videoUrl = null
      } else {
        if (typeof body.videoUrl !== 'string') return bad('Invalid video URL')
        if (!platinum) return bad('Video profiles are a Platinum feature', 403)
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        const prefix = `https://res.cloudinary.com/${cloudName}/video/upload/`
        if (!cloudName || !body.videoUrl.startsWith(prefix)) return bad('Video must be uploaded through Velour')
        updateData.videoUrl = body.videoUrl
      }
    }

    // Location coordinates (rounded to ~1 km for privacy). Send null for both to clear.
    if (body.latitude !== undefined || body.longitude !== undefined) {
      const { latitude: lat, longitude: lng } = body as { latitude?: unknown; longitude?: unknown }
      if (lat === null && lng === null) {
        updateData.latitude = null
        updateData.longitude = null
      } else {
        if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          return bad('latitude and longitude must both be numbers')
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return bad('Coordinates out of range')
        updateData.latitude = Math.round(lat * 100) / 100
        updateData.longitude = Math.round(lng * 100) / 100
      }
    }

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
