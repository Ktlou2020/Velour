import { NextRequest, NextResponse } from 'next/server'
import { maybeClaimFounding } from '@/lib/founding'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isOwnMediaUrl, mediaIdFromUrl } from '@/lib/media'
import { isPlatinum } from '@/lib/premium'
import { validatePrompts } from '@/app/profile/prompts'
import { Prisma } from '@prisma/client'
import { completenessOf, effectiveInterestedIn, isAdult, parseIdentityInput } from '@/lib/identity'
import { parseStatusInput } from '@/components/status/status'

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

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Invalid request')
    const { displayName, bio, dateOfBirth, relationshipStatus, location, city, country } = body
    const text = (v: unknown, max: number) =>
      typeof v === 'string' ? (v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) || null) : null

    const updateData: Record<string, unknown> = {}
    if (displayName !== undefined) updateData.displayName = text(displayName, 50)
    if (bio !== undefined) updateData.bio = text(bio, 500)
    if (dateOfBirth !== undefined) {
      const s = typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateOfBirth) ? dateOfBirth.slice(0, 10) : ''
      if (!s || !isAdult(s)) return bad('You must be at least 18 years old')
      updateData.dateOfBirth = new Date(`${s}T00:00:00.000Z`)
    }
    if (relationshipStatus !== undefined) updateData.relationshipStatus = text(relationshipStatus, 40)
    if (location !== undefined) updateData.location = text(location, 100)
    if (city !== undefined) updateData.city = text(city, 60)
    if (country !== undefined) updateData.country = text(country, 60)

    // Calculate profile completeness
    const existing = await db.profile.findUnique({
      where: { userId: session.user.id },
    })

    // Legacy clients may still send lookingFor (MAN/WOMAN/COUPLE/ANY) as the "who".
    if (Array.isArray(body.lookingFor) && body.interestedIn === undefined) {
      body.interestedIn = effectiveInterestedIn({ lookingFor: body.lookingFor.filter((v): v is string => typeof v === 'string') })
    }

    // Identity, preferences, about-me and couple details (validated in lib/identity)
    const identity = parseIdentityInput(body, {
      dateOfBirth: (updateData.dateOfBirth as Date | undefined) ?? existing?.dateOfBirth ?? null,
      isCouple: existing?.isCouple ?? false,
      partnerId: existing?.partnerId ?? null,
      gender: existing?.gender ?? null,
    })
    if ('error' in identity) return bad(identity.error)
    Object.assign(updateData, identity.data)
    if (updateData.coupleMembers === null) updateData.coupleMembers = Prisma.DbNull

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

    // Status ("Free tonight 🍷"): { emoji, text, duration: 'tonight' | '24h' | '3d' } or null to clear
    if (body.status !== undefined) {
      const result = parseStatusInput(body.status)
      if ('error' in result) return bad(result.error)
      Object.assign(updateData, result.data)
    }

    // Video profile (Platinum only to set; anyone may remove)
    if (body.videoUrl !== undefined) {
      if (body.videoUrl === null || body.videoUrl === '') {
        updateData.videoUrl = null
      } else {
        if (typeof body.videoUrl !== 'string') return bad('Invalid video URL')
        if (!platinum) return bad('Video profiles are a Platinum feature', 403)
        if (!isOwnMediaUrl(body.videoUrl, 'video')) return bad('Video must be uploaded through Unbound')
        const mediaId = mediaIdFromUrl(body.videoUrl)
        if (mediaId) {
          const owned = await db.photo.findFirst({ where: { id: mediaId, userId: session.user.id }, select: { id: true } })
          if (!owned) return bad('Video must be uploaded through Unbound')
        }
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

    const hasPhoto = (await db.photo.count({ where: { userId: session.user.id, isProfile: true } })) > 0
    updateData.profileCompleteness = completenessOf({ ...(existing ?? {}), ...updateData }, hasPhoto).completeness

    const profile = await db.profile.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    })

    // Founding offer: a newly eligible profile (gender set to Woman) claims a spot.
    await maybeClaimFounding(session.user.id)
    return NextResponse.json({ profile })
  } catch (error) {
    console.error('PUT /api/profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH is the same as PUT — accept both so client calls work regardless of method
export { PUT as PATCH }
