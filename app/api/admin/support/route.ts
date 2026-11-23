import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { listTickets } from '@/lib/support-admin'
import { isSupportStatus } from '@/lib/support'

/** GET ?status=OPEN|ANSWERED|CLOSED|ALL → newest tickets first, plus counts per status. */
export async function GET(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const raw = req.nextUrl.searchParams.get('status') ?? 'OPEN'
  if (raw !== 'ALL' && !isSupportStatus(raw)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  return NextResponse.json(await listTickets(raw))
}
