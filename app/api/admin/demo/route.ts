import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { audit } from '@/lib/admin-team'
import { countDemoProfiles, removeDemoProfiles, seedDemoProfiles } from '@/lib/demo-seed'

/** GET → { count }. POST { action: 'seed' | 'remove' } — super admins only. */
export async function GET() {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ count: await countDemoProfiles(), canManage: me.isSuperAdmin })
}

export async function POST(req: NextRequest) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!me.isSuperAdmin) return NextResponse.json({ error: 'Only a super admin can manage demo profiles' }, { status: 403 })
  try {
    const { action } = (await req.json().catch(() => ({}))) as { action?: string }
    if (action === 'seed') {
      const r = await seedDemoProfiles()
      await audit(me.id, 'DEMO_SEEDED', null, r)
      return NextResponse.json({ ...r, count: await countDemoProfiles() })
    }
    if (action === 'remove') {
      const removed = await removeDemoProfiles()
      await audit(me.id, 'DEMO_REMOVED', null, { removed })
      return NextResponse.json({ removed, count: 0 })
    }
    return NextResponse.json({ error: 'action must be seed or remove' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/admin/demo error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
