import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { recordProfileView } from '@/lib/views'
import { activeStatus } from '@/components/status/status'
import { ageFrom, genderLabelOf, orientationLabelOf, publicIdentity } from '@/lib/identity'

const PERSON_FIELDS = {
  displayName: true, dateOfBirth: true, gender: true, genderLabel: true, pronouns: true,
  orientation: true, showGender: true, showOrientation: true, heightCm: true, bodyType: true,
  ethnicity: true, showEthnicity: true, languages: true, drinking: true, smoking: true,
} as const

// Public-safe profile fields. Never expose coordinates, privacy flags or boost bookkeeping.
const PUBLIC_PROFILE_SELECT = {
  id: true,
  displayName: true,
  bio: true,
  dateOfBirth: true,
  gender: true,
  orientation: true,
  relationshipStatus: true,
  lookingFor: true,
  location: true,
  city: true,
  country: true,
  profilePhoto: true,
  isOnline: true,
  lastSeen: true,
  membershipTier: true,
  profileCompleteness: true,
  profileViews: true,
  allowMessages: true,
  isCouple: true,
  videoUrl: true,
  prompts: true,
  // Identity: read for the public view below, stripped by visibility settings.
  genderLabel: true,
  pronouns: true,
  showGender: true,
  showOrientation: true,
  interestedIn: true,
  intentions: true,
  coupleType: true,
  coupleMembers: true,
  hasChildren: true,
  heightCm: true,
  bodyType: true,
  ethnicity: true,
  showEthnicity: true,
  languages: true,
  drinking: true,
  smoking: true,
  statusText: true,
  statusEmoji: true,
  statusUntil: true,
  partner: { select: { ...PERSON_FIELDS, user: { select: { username: true, isActive: true } } } },
} as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params

    const user = await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        createdAt: true,
        isVerified: true,
        profile: { select: PUBLIC_PROFILE_SELECT },
        photos: {
          where: { isPrivate: false },
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
    if (user.id !== session.user.id) {
      const blocked = await db.block.findFirst({
        where: { OR: [{ blockerId: session.user.id, blockedId: user.id }, { blockerId: user.id, blockedId: session.user.id }] },
        select: { id: true },
      })
      if (blocked) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Track the view (deduped per 24h, skipped for self-views and incognito
    // viewers inside recordProfileView). ?track=0 lookups never count.
    if (req.nextUrl.searchParams.get('track') !== '0' && user.id !== session.user.id) {
      await recordProfileView(session.user.id, user.id)
    }

    return NextResponse.json({ user: { ...user, profile: user.profile ? publicProfile(user.profile, user.id === session.user.id) : null } })
  } catch (error) {
    console.error('GET /api/profile/[username] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type SelectedProfile = Prisma.ProfileGetPayload<{ select: typeof PUBLIC_PROFILE_SELECT }>

/**
 * The shape other members may see. Exact date of birth becomes an age;
 * hidden gender / orientation / ethnicity (and anything that would reveal
 * them) are removed. The owner sees their own data unchanged.
 */
function publicProfile(p: SelectedProfile, isSelf: boolean) {
  if (isSelf) {
    const { partner: _partner, ...rest } = p
    void _partner
    return { ...rest, status: activeStatus(p) }
  }
  const partner = p.partner && p.partner.user?.isActive !== false
    ? { ...p.partner, username: p.partner.user?.username ?? null }
    : null
  const identity = publicIdentity(p, partner)
  return {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio,
    age: ageFrom(p.dateOfBirth) ?? null,
    gender: p.showGender ? genderLabelOf(p.gender) ?? null : null,
    genderLabel: p.showGender ? p.genderLabel : null,
    pronouns: p.pronouns,
    orientation: p.showOrientation ? orientationLabelOf(p.orientation) ?? null : null,
    relationshipStatus: p.relationshipStatus,
    location: p.location,
    city: p.city,
    country: p.country,
    profilePhoto: p.profilePhoto,
    isOnline: p.isOnline,
    lastSeen: p.lastSeen,
    membershipTier: p.membershipTier,
    profileCompleteness: p.profileCompleteness,
    profileViews: p.profileViews,
    allowMessages: p.allowMessages,
    isCouple: p.isCouple,
    videoUrl: p.videoUrl,
    prompts: p.prompts,
    identity,
    // Only while it hasn't expired
    status: activeStatus(p),
  }
}
