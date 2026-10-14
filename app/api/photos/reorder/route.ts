import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'

/** POST /api/photos/reorder { ids: string[] } — set display order of my photos (first = 0). */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as { ids?: unknown } | null
    const ids = Array.isArray(body?.ids) ? body.ids : null
    if (!ids || ids.length === 0 || ids.length > 300 || !ids.every(isValidId) || new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: 'ids must be a list of your photo ids' }, { status: 400 })
    }
    const owned = await db.photo.count({ where: { userId, id: { in: ids } } })
    if (owned !== ids.length) return NextResponse.json({ error: 'ids must be a list of your photo ids' }, { status: 400 })

    await db.$transaction(ids.map((id, order) => db.photo.update({ where: { id }, data: { order } })))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/photos/reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
