import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { entitlements } from '@/lib/plans'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Record that `viewerId` looked at `viewedId`'s profile.
 *
 * - Never records self-views or views by incognito members.
 * - At most one ProfileView row (and one profileViews increment) per viewer
 *   per profile per 24h, so refreshing doesn't inflate counts.
 * - Members who can see who viewed them get a notification + push for each
 *   new (deduplicated) view.
 *
 * Errors are swallowed: view tracking must never break page rendering.
 */
export async function recordProfileView(viewerId: string, viewedId: string): Promise<void> {
  if (!viewerId || !viewedId || viewerId === viewedId) return
  try {
    const viewer = await db.user.findUnique({
      where: { id: viewerId },
      select: { username: true, profile: { select: { incognito: true, displayName: true } } },
    })
    if (!viewer || viewer.profile?.incognito) return

    const since = new Date(Date.now() - DAY_MS)
    const recent = await db.profileView.findFirst({
      where: { viewerId, viewedId, createdAt: { gte: since } },
      select: { id: true },
    })
    if (recent) return

    await db.$transaction([
      db.profileView.create({ data: { viewerId, viewedId } }),
      db.profile.updateMany({ where: { userId: viewedId }, data: { profileViews: { increment: 1 } } }),
    ])

    const owner = await db.user.findUnique({
      where: { id: viewedId },
      select: { role: true, profile: { select: { membershipTier: true } } },
    })
    if (!owner || !entitlements(owner.profile?.membershipTier, owner.role).seeWhoViewedYou) return

    const name = viewer.profile?.displayName || `@${viewer.username}`
    await db.notification.create({
      data: {
        userId: viewedId,
        type: 'PROFILE_VIEW',
        title: 'Someone viewed your profile',
        body: `${name} viewed your profile`,
        data: { viewerId, viewerUsername: viewer.username, url: `/members/${viewer.username}` },
      },
    })
    sendPushToUser(viewedId, {
      title: 'Profile view — Hush',
      body: `${name} viewed your profile`,
      url: '/views',
      tag: `view-${viewerId}`,
    }).catch(() => {})
  } catch (error) {
    console.error('recordProfileView failed:', error instanceof Error ? error.message : error)
  }
}
