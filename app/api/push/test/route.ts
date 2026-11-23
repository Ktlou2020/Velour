import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendPushToDevice } from '@/lib/push'
import { rateLimit } from '@/lib/rate-limit'

/** POST { endpoint } → sends a test alert to this device (Settings → App & notifications). */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`push-test:${session.user.id}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'You’ve sent a few tests already — try again in a few minutes.' }, { status: 429 })
  }
  const { endpoint } = await req.json().catch(() => ({})) as { endpoint?: unknown }
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'Turn notifications on first' }, { status: 400 })
  }
  const ok = await sendPushToDevice(session.user.id, endpoint, {
    title: 'Notifications are on ✓',
    body: 'This is how you’ll hear about new messages and matches on Unbound.',
    url: '/account',
    tag: 'push-test',
  })
  if (!ok) return NextResponse.json({ error: 'That didn’t reach this device — turn notifications off and on again.' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
