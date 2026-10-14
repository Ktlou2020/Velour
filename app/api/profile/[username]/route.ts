import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
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

    // Track profile view (don't count self-views, incognito viewers, or ?track=0 lookups)
    const skipTracking = req.nextUrl.searchParams.get('track') === '0'
    let viewerIncognito = false
    if (!skipTracking && user.id !== session.user.id) {
      const viewerProfile = await db.profile.findUnique({
        where: { userId: session.user.id },
        select: { incognito: true },
      })
      viewerIncognito = !!viewerProfile?.incognito
    }
    if (!skipTracking && !viewerIncognito && user.id !== session.user.id) {
      await db.profile.update({
        where: { userId: user.id },
        data: { profileViews: { increment: 1 } },
      })

      // Create PROFILE_VIEW notification for GOLD/PLATINUM users only, deduplicated per 24h
      const ownerProfile = user.profile
      if (
        ownerProfile &&
        (ownerProfile.membershipTier === 'GOLD' || ownerProfile.membershipTier === 'PLATINUM')
      ) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const viewerUser = await db.user.findUnique({
          where: { id: session.user.id },
          select: { username: true },
        })

        const existingView = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'PROFILE_VIEW',
            createdAt: { gte: oneDayAgo },
            data: {
              path: ['viewerId'],
              equals: session.user.id,
            },
          },
        })

        if (!existingView && viewerUser) {
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'PROFILE_VIEW',
              title: 'Someone viewed your profile',
              body: `@${viewerUser.username} viewed your profile`,
              data: { viewerId: session.user.id, viewerUsername: viewerUser.username },
            },
          })
          sendPushToUser(user.id, {
            title: 'Profile View — Hush',
            body: `@${viewerUser.username} viewed your profile`,
            url: '/views',
            tag: `view-${session.user.id}`,
          }).catch(() => {})
        }
      }
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
    return rest
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
  }
}
