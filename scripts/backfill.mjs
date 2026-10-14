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
}

main()
  .catch((e) => console.error('[backfill] failed:', e instanceof Error ? e.message : e))
  .finally(() => db.$disconnect())
