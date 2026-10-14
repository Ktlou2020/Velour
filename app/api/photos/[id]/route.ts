import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const raw = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!raw) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const body = {
      isPrivate: typeof raw.isPrivate === 'boolean' ? raw.isPrivate : undefined,
      isProfile: typeof raw.isProfile === 'boolean' ? raw.isProfile : undefined,
      caption: typeof raw.caption === 'string' ? raw.caption.slice(0, 300) : undefined,
    }

    const photo = await db.photo.findUnique({ where: { id } })
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (photo.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (body.isProfile) {
      await db.photo.updateMany({
        where: { userId: session.user.id, isProfile: true },
        data: { isProfile: false },
      })
      await db.profile.updateMany({
        where: { userId: session.user.id },
        data: { profilePhoto: photo.url },
      })
    }

    const updated = await db.photo.update({
      where: { id },
      data: {
        ...(body.isPrivate !== undefined ? { isPrivate: body.isPrivate } : {}),
        ...(body.isProfile !== undefined ? { isProfile: body.isProfile } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
      },
    })

    return NextResponse.json({ photo: updated })
  } catch (error) {
    console.error('PATCH /api/photos/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const photo = await db.photo.findUnique({ where: { id } })
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (photo.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await db.photo.delete({ where: { id } })

    if (photo.isProfile) {
      await db.profile.updateMany({
        where: { userId: session.user.id },
        data: { profilePhoto: null },
      })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/photos/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
