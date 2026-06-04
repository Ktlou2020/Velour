import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const email = 'kagiso@svcapital.co.za'
  const result = await db.user.updateMany({
    where: { email },
    data: { role: 'ADMIN', isVerified: true },
  })
  if (result.count > 0) {
    console.log(`✓ Admin role set for ${email}`)
  } else {
    console.log(`⚠ No user found with email ${email} — will retry on next restart`)
  }
}

main().catch(console.error).finally(() => db.$disconnect())
