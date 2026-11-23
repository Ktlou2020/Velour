import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { sendBrandedEmail, escapeHtml } from '@/lib/email'
import { deleteOwnPhoto } from '@/lib/photos'
import { CHAT_ALBUM_NAME, STORE_ALBUM_NAME, VIDEO_ALBUM_NAME } from '@/lib/media'

/**
 * Admin photo review. Public photos uploaded from REVIEW_SINCE wait in the
 * queue at /admin/photos until an admin approves or removes them; they are
 * visible meanwhile (post-moderation, so sign-up isn't slowed down). Chat
 * media, private photos and private albums are not part of this queue.
 */
export const REVIEW_SINCE = new Date('2026-11-23T00:00:00Z')

export const REMOVE_REASONS = [
  'Nudity or sexual content on a public photo',
  'Not a real photo of the member',
  'Shows someone else or a minor',
  'Contains contact details or advertising',
  'Offensive or violent content',
  'Low quality or no person visible',
] as const

export function reviewQueueWhere(): Prisma.PhotoWhereInput {
  return {
    reviewedAt: null,
    createdAt: { gte: REVIEW_SINCE },
    isPrivate: false,
    user: { isDemo: false },
    OR: [
      { albumId: null },
      { album: { isPrivate: false, name: { notIn: [CHAT_ALBUM_NAME, VIDEO_ALBUM_NAME, STORE_ALBUM_NAME] } } },
    ],
  }
}

export async function approvePhoto(photoId: string, adminId: string): Promise<boolean> {
  const r = await db.photo.updateMany({ where: { id: photoId, reviewedAt: null }, data: { reviewedAt: new Date(), reviewedById: adminId } })
  return r.count > 0
}

/** Delete the photo and tell the member why. Returns the owner's id, or null if it no longer exists. */
export async function removePhoto(photoId: string, reason: string): Promise<string | null> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { userId: true, isProfile: true, user: { select: { email: true, username: true, profile: { select: { displayName: true } } } } },
  })
  if (!photo) return null
  const ok = await deleteOwnPhoto(photo.userId, photoId)
  if (!ok) return null
  const main = photo.isProfile
  await db.notification.create({
    data: {
      userId: photo.userId,
      type: 'SYSTEM',
      title: 'A photo was removed',
      body: `One of your photos was removed: ${reason}.${main ? ' Please add a new profile photo to keep using Unbound.' : ''}`,
      data: { url: '/profile#photos' },
    },
  }).catch(() => {})
  const name = photo.user.profile?.displayName || photo.user.username
  sendBrandedEmail(
    photo.user.email,
    'A photo on your Unbound profile was removed',
    'Photo removed',
    `<p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 16px;">Hi ${escapeHtml(name)}, one of your photos was removed by our team because: <strong style="color:#fff;">${escapeHtml(reason)}</strong>.</p>
     <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0;">${main ? 'It was your profile photo, so please add a new one — ' : ''}Public photos should clearly show you, with no nudity, contact details or other people's faces. Private albums are still yours to share with people you choose.</p>`,
  ).catch(() => {})
  return photo.userId
}
