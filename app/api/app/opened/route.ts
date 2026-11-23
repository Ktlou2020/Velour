import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

/**
 * POST { event: 'opened' | 'installed' } — the member opened Unbound from the
 * home screen (or just installed it). Feeds the admin "Using the app" numbers.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { event } = await req.json().catch(() => ({})) as { event?: unknown }
  if (event !== 'opened' && event !== 'installed') return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  const now = new Date()
  await db.profile.updateMany({ where: { userId, appInstalledAt: null }, data: { appInstalledAt: now } })
  if (event === 'opened') await db.profile.updateMany({ where: { userId }, data: { appLastOpenedAt: now } })
  return NextResponse.json({ ok: true })
}
