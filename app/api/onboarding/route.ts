import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { completenessOf, effectiveInterestedIn, parseCoupleMembers, parseIdentityInput } from '@/lib/identity'
import { parsePrompts, validatePrompts } from '@/app/profile/prompts'

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

const clean = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const t = v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max)
  return t || null
}

/** GET /api/onboarding — everything the onboarding flow needs to prefill / resume. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return bad('Unauthorized', 401)
  const userId = session.user.id
  const [profile, photos] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      include: { partner: { select: { displayName: true, user: { select: { username: true } } } } },
    }),
    db.photo.findMany({ where: { userId, isPrivate: false }, orderBy: { order: 'asc' }, select: { id: true, url: true } }),
  ])
  const p = profile
  return NextResponse.json({
    profile: {
      isCouple: p?.isCouple ?? false,
      partnerUsername: p?.partner?.user?.username ?? null,
      displayName: p?.displayName ?? '',
      city: p?.city ?? '',
      country: p?.country ?? '',
      dateOfBirth: p?.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      gender: p?.gender ?? null,
      genderLabel: p?.genderLabel ?? '',
      pronouns: p?.pronouns ?? '',
      orientation: p?.orientation ?? '',
      showGender: p?.showGender ?? true,
      showOrientation: p?.showOrientation ?? true,
      // Existing members who only have the legacy lookingFor get it mapped across.
      interestedIn: p ? (p.interestedIn.length ? p.interestedIn : effectiveInterestedIn(p)) : [],
      intentions: p?.intentions ?? [],
      coupleType: p?.coupleType ?? null,
      coupleMembers: parseCoupleMembers(p?.coupleMembers),
      heightCm: p?.heightCm ?? null,
      bodyType: p?.bodyType ?? null,
      ethnicity: p?.ethnicity ?? '',
      showEthnicity: p?.showEthnicity ?? false,
      languages: p?.languages ?? [],
      drinking: p?.drinking ?? null,
      smoking: p?.smoking ?? null,
      hasChildren: p?.hasChildren ?? null,
      bio: p?.bio ?? '',
      prompts: parsePrompts(p?.prompts),
    },
    photos,
  })
}

/**
 * POST /api/onboarding — saves one onboarding step. Only the keys sent are
 * written. Date of birth is deliberately NOT accepted here: it is collected
 * (and checked for 18+) once, at sign-up.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return bad('Unauthorized', 401)
    const userId = session.user.id

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Invalid request')

    const existing = await db.profile.findUnique({ where: { userId } })

    const parsed = parseIdentityInput(body, {
      dateOfBirth: existing?.dateOfBirth ?? null,
      isCouple: existing?.isCouple ?? false,
      partnerId: existing?.partnerId ?? null,
      gender: existing?.gender ?? null,
    })
    if ('error' in parsed) return bad(parsed.error)
    const data = parsed.data
    if (data.coupleMembers === null) data.coupleMembers = Prisma.DbNull

    const displayName = clean(body.displayName, 50)
    if (displayName !== undefined) {
      if (!displayName) return bad('Please add a display name')
      data.displayName = displayName
    }
    const city = clean(body.city, 60); if (city !== undefined) data.city = city
    const country = clean(body.country, 60); if (country !== undefined) data.country = country
    const bio = clean(body.bio, 500); if (bio !== undefined) data.bio = bio
    if (body.prompts !== undefined) {
      const r = validatePrompts(body.prompts)
      if ('error' in r) return bad(r.error)
      data.prompts = r.prompts
    }

    const hasPhoto = (await db.photo.count({ where: { userId, isProfile: true } })) > 0
    data.profileCompleteness = completenessOf({ ...(existing ?? {}), ...data }, hasPhoto).completeness

    const profile = await db.profile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      select: { id: true, isCouple: true, coupleType: true, profileCompleteness: true },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('POST /api/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
