import webpush from 'web-push'
import { db } from '@/lib/db'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:hello@velour.dating',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
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
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

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
          data
        )
      } catch (err: unknown) {
        // 410 Gone or 404 = subscription expired, remove it
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 410 || status === 404) {
          failed.push(sub.endpoint)
        }
      }
    })
  )

  if (failed.length > 0) {
    await db.pushSubscription.deleteMany({ where: { endpoint: { in: failed } } })
  }
}
