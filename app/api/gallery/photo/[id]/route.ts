import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getExplorePhoto, loadViewer } from '@/lib/explore'
import { isValidId } from '@/lib/security'

/** GET /api/gallery/photo/<id> — one Explore photo (deep links, e.g. from a like notification). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const viewer = await loadViewer(session.user.id)
    if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const photo = await getExplorePhoto(viewer, id)
    if (!photo) return NextResponse.json({ error: 'This photo is no longer available' }, { status: 404 })
    return NextResponse.json({ photo }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('GET /api/gallery/photo/[id] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
