import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { completenessOf } from '@/lib/identity'
import { DEMO_CITIES, DEMO_PROFILES } from '@/lib/demo-profiles'
import { deleteFiles, photoFileKeys } from '@/lib/storage'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Small random offset so profiles in one city aren't stacked on the same point (~±3 km). */
const jitter = () => (Math.random() - 0.5) * 0.06

export async function countDemoProfiles(): Promise<number> {
  return db.user.count({ where: { isDemo: true } })
}

/**
 * Create the demo profiles that don't exist yet (idempotent: matched by
 * username). Their accounts can't be signed into (random password, .invalid
 * email) and they never act on real members.
 */
export async function seedDemoProfiles(): Promise<{ created: number; skipped: number }> {
  const now = Date.now()
  let created = 0
  let skipped = 0
  for (const d of DEMO_PROFILES) {
    const exists = await db.user.findUnique({ where: { username: d.username }, select: { id: true } })
    if (exists) { skipped++; continue }
    const place = DEMO_CITIES[d.where]
    const createdAt = new Date(now - d.joinedDaysAgo * DAY - Math.floor(Math.random() * 12) * HOUR)
    const lastSeen = new Date(now - d.lastSeenHoursAgo * HOUR - Math.floor(Math.random() * 50) * 60_000)
    const isCouple = !!d.couple
    const profile = {
      displayName: d.displayName,
      bio: d.bio,
      dateOfBirth: new Date(`${d.dateOfBirth}T00:00:00.000Z`),
      gender: d.gender,
      pronouns: d.pronouns ?? null,
      orientation: d.orientation,
      city: place.city,
      country: 'South Africa',
      location: `${place.city}, South Africa`,
      latitude: place.lat + jitter(),
      longitude: place.lng + jitter(),
      interestedIn: d.interestedIn,
      intentions: d.intentions,
      lookingFor: [],
      heightCm: d.heightCm ?? null,
      bodyType: d.bodyType ?? null,
      languages: d.languages,
      drinking: d.drinking ?? null,
      smoking: d.smoking ?? null,
      hasChildren: d.hasChildren ?? null,
      prompts: d.prompts,
      isCouple,
      coupleType: d.couple?.type ?? null,
      statusText: d.statusText ?? null,
      statusEmoji: d.statusEmoji ?? null,
      statusUntil: d.statusText ? new Date(now + 5 * DAY) : null,
      lastSeen,
      isOnline: false,
    }
    const { completeness } = completenessOf(profile as unknown as Record<string, unknown>, false)
    await db.user.create({
      data: {
        email: `${d.username.replace(/[^a-z0-9]/gi, '')}@demo.unboundza.invalid`,
        username: d.username,
        passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
        isDemo: true,
        isActive: true,
        emailVerifiedAt: createdAt,
        emailMarketingOptOut: true,
        createdAt,
        profile: {
          create: {
            ...profile,
            ...(d.couple ? { coupleMembers: d.couple.members.map((m) => ({ ...m })) } : {}),
            profileCompleteness: completeness,
          } as never,
        },
      },
    })
    created++
  }
  return { created, skipped }
}

/** Delete every demo profile (and anything attached to them, via cascades). */
export async function removeDemoProfiles(): Promise<number> {
  const ids = (await db.user.findMany({ where: { isDemo: true }, select: { id: true } })).map((u) => u.id)
  if (ids.length === 0) return 0
  // Conversations they were in (as participants) go too, so members don't see empty chats.
  const convs = await db.conversationParticipant.findMany({ where: { userId: { in: ids } }, select: { conversationId: true } })
  // Their uploaded photo files (rows go with the cascade; files must be deleted explicitly).
  const photos = await db.photo.findMany({ where: { userId: { in: ids } }, select: { storageKey: true, mimeType: true } })
  await db.$transaction([
    db.conversation.deleteMany({ where: { id: { in: [...new Set(convs.map((c) => c.conversationId))] } } }),
    db.user.deleteMany({ where: { id: { in: ids } } }),
  ])
  await deleteFiles(photos.flatMap(photoFileKeys))
  return ids.length
}
