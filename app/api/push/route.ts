import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { pushEnabled, vapidPublicKey } from '@/lib/push'

// POST: Save a push subscription
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!pushEnabled()) {
      return NextResponse.json({ error: 'Push notifications are not available' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const { endpoint, keys } = body as {
      endpoint?: unknown
      keys?: { p256dh?: unknown; auth?: unknown }
    }

    if (
      typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 2000 ||
      typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' ||
      keys.p256dh.length > 200 || keys.auth.length > 100
    ) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/push error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove a push subscription
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown }

    if (typeof endpoint === 'string' && endpoint) {
      await db.pushSubscription.deleteMany({
        where: { endpoint, userId: session.user.id },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/push error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: { enabled, publicKey } — the client only offers "Enable notifications"
// when enabled is true (VAPID keys configured on the server).
export async function GET() {
  const enabled = pushEnabled()
  return NextResponse.json(
    { enabled, publicKey: enabled ? vapidPublicKey() : '' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
