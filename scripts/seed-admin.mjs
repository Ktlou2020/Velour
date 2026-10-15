// Grants the ADMIN role to the accounts listed in ADMIN_EMAILS and
// SUPER_ADMIN_EMAILS (comma-separated). Runs on every deploy (see railway.toml).
// It only ever promotes. Admins appointed by a super admin in the admin panel
// (Admin team) are left alone; to remove an admin listed in ADMIN_EMAILS, take
// them out of ADMIN_EMAILS *and* remove them in the admin panel.
// Keep DEFAULT_SUPER_ADMIN_EMAILS in sync with lib/admin-roles.ts.
import { PrismaClient } from '@prisma/client'

// Legacy fallback so production keeps its admin until ADMIN_EMAILS is set.
const LEGACY_ADMIN_EMAIL = 'kagiso@svcapital.co.za'

const DEFAULT_SUPER_ADMIN_EMAILS = 'thuto231990@gmail.com'

const db = new PrismaClient()

async function main() {
  const fromEnv = process.env.ADMIN_EMAILS
  const supers = (process.env.SUPER_ADMIN_EMAILS ?? DEFAULT_SUPER_ADMIN_EMAILS).split(',')
  const emails = [...new Set([...(fromEnv ?? LEGACY_ADMIN_EMAIL).split(','), ...supers]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean))]

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
      data: { role: 'ADMIN', isVerified: true, emailVerifiedAt: new Date() },
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
