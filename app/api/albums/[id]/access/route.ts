import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isValidId } from '@/lib/security'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { USER_SUMMARY_SELECT, findUserAlbum, userSummary } from '@/lib/albums'
import { ACCESS, displayNameOf, isBlockedBetween, notify } from '@/lib/media-access'

type Ctx = { params: Promise<{ id: string }> }
const notFound = () => NextResponse.json({ error: 'Album not found' }, { status: 404 })

/** GET /api/albums/<id>/access — owner: { granted: [...], requests: [...] } */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return notFound()
    const album = await findUserAlbum(id)
    if (!album || album.ownerId !== userId) return notFound()

    const rows = await db.albumAccess.findMany({
      where: { albumId: id, status: { in: [ACCESS.GRANTED, ACCESS.REQUESTED] }, user: { isActive: true } },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, createdAt: true, updatedAt: true, user: { select: USER_SUMMARY_SELECT } },
    })
    const toItem = (r: (typeof rows)[number]) => ({ ...userSummary(r.user), status: r.status, since: r.updatedAt })
    return NextResponse.json({
      granted: rows.filter((r) => r.status === ACCESS.GRANTED).map(toItem),
      requests: rows.filter((r) => r.status === ACCESS.REQUESTED).map(toItem),
    })
  } catch (error) {
    console.error('GET /api/albums/[id]/access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/albums/<id>/access { username } — owner shares a private album.
 * Access is granted immediately (an outstanding request is approved); the
 * member is notified and can leave at any time.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!isValidId(id)) return notFound()
    const album = await findUserAlbum(id)
    if (!album || album.ownerId !== userId) return notFound()
    if (!album.isPrivate) {
      return NextResponse.json({ error: 'This album is public — every member can already see it. Make it private to share it with specific people.' }, { status: 400 })
    }
    if (!rateLimit(`album-invite:${userId}`, 60, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as { username?: unknown } | null
    const username = typeof body?.username === 'string' ? body.username.trim().replace(/^@/, '') : ''
    if (!username || username.length > 40) return NextResponse.json({ error: 'Enter a username' }, { status: 400 })

    const invitee = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, isActive: true },
      select: USER_SUMMARY_SELECT,
    })
    // Same message for "no such user" and "blocked" so blocks aren't revealed.
    if (!invitee || (await isBlockedBetween(userId, invitee.id))) {
      return NextResponse.json({ error: `No member called @${username}` }, { status: 404 })
    }
    if (invitee.id === userId) return NextResponse.json({ error: 'You already own this album' }, { status: 400 })

    const existing = await db.albumAccess.findUnique({
      where: { albumId_userId: { albumId: id, userId: invitee.id } },
      select: { status: true },
    })
    if (existing?.status === ACCESS.GRANTED) {
      return NextResponse.json({ member: { ...userSummary(invitee), status: ACCESS.GRANTED }, alreadyShared: true })
    }
    await db.albumAccess.upsert({
      where: { albumId_userId: { albumId: id, userId: invitee.id } },
      create: { albumId: id, userId: invitee.id, status: ACCESS.GRANTED },
      update: { status: ACCESS.GRANTED },
    })

    const me = await displayNameOf(userId)
    const wasRequest = existing?.status === ACCESS.REQUESTED
    await notify(invitee.id, {
      type: wasRequest ? 'ALBUM_GRANTED' : 'ALBUM_INVITE',
      title: wasRequest ? 'Access granted' : 'Private album shared with you',
      body: wasRequest
        ? `${me.name} approved your request to see “${album.name}”.`
        : `${me.name} shared their private album “${album.name}” with you.`,
      url: `/gallery?tab=shared&album=${id}`,
      data: { albumId: id, fromUsername: me.username },
    })
    return NextResponse.json({ member: { ...userSummary(invitee), status: ACCESS.GRANTED } }, { status: 201 })
  } catch (error) {
    console.error('POST /api/albums/[id]/access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
