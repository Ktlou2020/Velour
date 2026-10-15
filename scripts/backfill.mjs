// Idempotent data repairs, run on every start (before the app boots).
// Keep each statement safe to re-run and cheap when there's nothing to do.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Array columns added after launch can be NULL on older rows; Prisma's
  // `isEmpty`/`has` filters never match NULL, which silently hid those
  // members from search. Normalise to empty arrays.
  for (const col of ['lookingFor', 'interestedIn', 'intentions', 'languages']) {
    const n = await db.$executeRawUnsafe(`UPDATE "Profile" SET "${col}" = '{}' WHERE "${col}" IS NULL`)
    if (n > 0) console.log(`[backfill] Profile.${col}: set ${n} NULL value(s) to []`)
  }

  // Founding members (lib/founding.ts): give remaining spots to the oldest
  // eligible accounts (women and couples) that don't have one yet. Same lock as sign-up claims.
  const limit = Math.max(0, Number(process.env.FOUNDING_MEMBER_LIMIT ?? 30) || 0)
  const granted = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(74210301)')
    const agg = await tx.profile.aggregate({ _max: { foundingMemberNumber: true } })
    let next = (agg._max.foundingMemberNumber ?? 0) + 1
    if (next > limit) return []
    const candidates = await tx.profile.findMany({
      where: { foundingMemberNumber: null, OR: [{ isCouple: true }, { gender: 'WOMAN' }], user: { role: { not: 'ADMIN' }, isActive: true } },
      orderBy: { user: { createdAt: 'asc' } },
      take: limit - next + 1,
      select: { userId: true },
    })
    const out = []
    for (const c of candidates) {
      await tx.profile.update({ where: { userId: c.userId }, data: { foundingMemberNumber: next, membershipTier: 'PLATINUM' } })
      await tx.notification.create({
        data: {
          userId: c.userId,
          type: 'SYSTEM',
          title: `You're founding member #${next} 👑`,
          body: 'As one of our first members you get Platinum free, forever. Thank you for being here from the start.',
          data: { url: '/subscription' },
        },
      })
      out.push(next++)
    }
    return out
  })
  if (granted.length) console.log(`[backfill] founding members: granted #${granted[0]}–#${granted[granted.length - 1]}`)
}

main()
  .catch((e) => console.error('[backfill] failed:', e instanceof Error ? e.message : e))
  .finally(() => db.$disconnect())
