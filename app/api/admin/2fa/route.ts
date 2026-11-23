import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mfaRequired } from '@/lib/admin-mfa'
import { adminIdentity } from './shared'

/** GET → { enabled, required, recoveryLeft } for the signed-in admin. */
export async function GET() {
  const me = await adminIdentity()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const u = await db.user.findUnique({ where: { id: me.id }, select: { totpEnabledAt: true, totpRecoveryHashes: true } })
  return NextResponse.json({ enabled: !!u?.totpEnabledAt, required: mfaRequired(), recoveryLeft: u?.totpRecoveryHashes.length ?? 0 })
}
