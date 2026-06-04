import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const COMPLETENESS_FIELDS = [
  'displayName',
  'bio',
  'dateOfBirth',
  'gender',
  'orientation',
  'lookingFor',
  'city',
  'country',
  'profilePhoto',
  'location',
] as const

function calculateCompleteness(profile: Record<string, unknown>): number {
  const filled = COMPLETENESS_FIELDS.filter((field) => {
    const val = profile[field]
    if (val === null || val === undefined) return false
    if (Array.isArray(val)) return val.length > 0
    return true
  }).length
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { displayName, dateOfBirth, gender, orientation, lookingFor, relationshipStatus, city, country, bio } =
      body as {
        displayName?: string
        dateOfBirth?: string
        gender?: string
        orientation?: string
        lookingFor?: string[]
        relationshipStatus?: string
        city?: string
        country?: string
        bio?: string
      }

    const data: Record<string, unknown> = {}
    if (displayName !== undefined) data.displayName = displayName
    if (dateOfBirth !== undefined) data.dateOfBirth = new Date(dateOfBirth)
    if (gender !== undefined) data.gender = gender
    if (orientation !== undefined) data.orientation = orientation
    if (lookingFor !== undefined) data.lookingFor = lookingFor
    if (relationshipStatus !== undefined) data.relationshipStatus = relationshipStatus
    if (city !== undefined) data.city = city
    if (country !== undefined) data.country = country
    if (bio !== undefined) data.bio = bio

    // Get or create profile, then calculate completeness
    const existing = await db.profile.findUnique({
      where: { userId: session.user.id },
    })

    const merged = { ...(existing ?? {}), ...data }
    data.profileCompleteness = calculateCompleteness(merged as Record<string, unknown>)

    const profile = await db.profile.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('POST /api/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
