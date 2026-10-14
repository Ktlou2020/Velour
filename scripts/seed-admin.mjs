// Grants the ADMIN role to the accounts listed in ADMIN_EMAILS (comma-separated).
// Runs on every deploy (see railway.toml). It only ever promotes; to remove an
// admin, take them out of ADMIN_EMAILS *and* demote them in the admin panel/DB.
import { PrismaClient } from '@prisma/client'

// Legacy fallback so production keeps its admin until ADMIN_EMAILS is set.
const LEGACY_ADMIN_EMAIL = 'kagiso@svcapital.co.za'

const db = new PrismaClient()

async function main() {
  const fromEnv = process.env.ADMIN_EMAILS
  const emails = (fromEnv ?? LEGACY_ADMIN_EMAIL)
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  if (fromEnv === undefined) {
    console.log(`[seed-admin] ADMIN_EMAILS is not set; falling back to the built-in default. Set ADMIN_EMAILS to manage admins explicitly.`)
  }
  if (emails.length === 0) {
    console.log('[seed-admin] ADMIN_EMAILS is empty; no admins granted.')
    return
  }

  for (const email of emails) {
    const result = await db.user.updateMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      data: { role: 'ADMIN', isVerified: true },
    })
    if (result.count > 0) {
      console.log(`[seed-admin] ✓ ADMIN role set for ${email} (note: email ownership is not re-checked here)`)
    } else {
      console.log(`[seed-admin] ⚠ No user found with email ${email} — will retry on next restart`)
    }
  }
}

main()
  .catch((err) => console.error('[seed-admin] failed:', err instanceof Error ? err.message : err))
  .finally(() => db.$disconnect())
