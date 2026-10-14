import { NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { seedSampleCatalogue } from '@/lib/store/seed'

export const dynamic = 'force-dynamic'

/** POST → create the sample categories and products (skips any that already exist). */
export async function POST() {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ ok: true, created: await seedSampleCatalogue() })
  } catch (error) {
    console.error('POST /api/admin/store/seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
