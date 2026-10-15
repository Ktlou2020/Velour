import webpush from 'web-push'
import { db } from '@/lib/db'

// Web push is optional. Without VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY every
// call here is a silent no-op (in-app notifications still work) and
// GET /api/push reports { enabled: false } so the UI never offers it.
// Generate keys with `npx web-push generate-vapid-keys` (see README).

let configured: boolean | null = null

/** The public VAPID key the browser subscribes with ('' when push is off). */
export function vapidPublicKey(): string {
  return (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()
}

/** True once web-push has valid VAPID details; never throws. */
export function pushEnabled(): boolean {
  if (configured !== null) return configured
  const pub = vapidPublicKey()
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim()
  if (!pub || !priv) {
    configured = false
    return configured
  }
  try {
    const subject = (process.env.VAPID_SUBJECT || '').trim() || 'mailto:hello@unboundza.com'
    webpush.setVapidDetails(subject, pub, priv)
    configured = true
  } catch (e) {
    // Malformed keys: log once, then behave as if push were off
    console.error('Web push disabled — invalid VAPID keys:', e instanceof Error ? e.message : e)
    configured = false
  }
  return configured
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushEnabled()) return

  const subs = await db.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const data = JSON.stringify({
    ...payload,
    icon: payload.icon ?? '/icon-192.png',
    badge: payload.badge ?? '/icon-192.png',
  })

  const failed: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
          { TTL: 60 * 60 * 24 }
        )
      } catch (err: unknown) {
        // 404 / 410 = subscription expired or revoked → remove it
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 410 || status === 404) failed.push(sub.endpoint)
      }
    })
  )

  if (failed.length > 0) {
    await db.pushSubscription.deleteMany({ where: { endpoint: { in: failed } } })
  }
}
