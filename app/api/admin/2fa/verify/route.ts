import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/admin-team'
import { issueTicket, verifyAdminCode } from '@/lib/admin-mfa'
import { adminIdentity } from '../shared'

/**
 * POST { code } → { ticket, recoveryCodes?, recoveryLeft }. The browser then
 * calls useSession().update({ mfaTicket: ticket }) to finish signing in.
 */
export async function POST(req: NextRequest) {
  const me = await adminIdentity()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!rateLimit(`admin-2fa:${me.id}`, 6, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many tries — wait 10 minutes and try again.' }, { status: 429 })
  }
  const { code } = await req.json().catch(() => ({})) as { code?: unknown }
  if (typeof code !== 'string' || !code.trim() || code.length > 40) return NextResponse.json({ error: 'Enter the code from your app' }, { status: 400 })
  try {
    const r = await verifyAdminCode(me.id, code)
    if (!r.ok) {
      await audit(me.id, 'ADMIN_2FA_FAILED', me.id)
      return NextResponse.json({ error: r.error }, { status: 400 })
    }
    if (r.enabledNow) await audit(me.id, 'ADMIN_2FA_ENABLED', me.id)
    if (r.usedRecovery) await audit(me.id, 'ADMIN_2FA_BACKUP_CODE_USED', me.id, { left: r.recoveryLeft })
    const ticket = await issueTicket(me.id)
    return NextResponse.json({ ticket, recoveryCodes: r.recoveryCodes, recoveryLeft: r.recoveryLeft }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('POST /api/admin/2fa/verify error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
  }
}
