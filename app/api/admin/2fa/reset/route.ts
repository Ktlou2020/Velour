import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'

/** POST { userId } → super admins clear another admin's two-step login (lost phone). They set it up again at next sign-in. */
export async function POST(req: NextRequest) {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Only a super admin can do this' }, { status: 403 })
  const { userId } = await req.json().catch(() => ({})) as { userId?: unknown }
  if (!isValidId(userId)) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (userId === me.id) return NextResponse.json({ error: 'Use a backup code to reset your own' }, { status: 400 })
  const r = await db.user.updateMany({
    where: { id: userId, role: 'ADMIN' },
    data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryHashes: [], mfaTicketHash: null, mfaTicketExpires: null },
  })
  if (r.count !== 1) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  await audit(me.id, 'ADMIN_2FA_RESET', userId)
  return NextResponse.json({ ok: true })
}
