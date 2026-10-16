import { db } from '@/lib/db'
import { deleteFiles, photoFileKeys } from '@/lib/storage'
import { maybeRewardReferral } from '@/lib/referrals'

/** Make `photoId` the user's main photo (Photo.isProfile + Profile.profilePhoto). */
export async function setMainPhoto(userId: string, photo: { id: string; url: string }) {
  await db.$transaction([
    db.photo.updateMany({ where: { userId, isProfile: true, id: { not: photo.id } }, data: { isProfile: false } }),
    db.photo.update({ where: { id: photo.id }, data: { isProfile: true } }),
    db.profile.updateMany({ where: { userId }, data: { profilePhoto: photo.url } }),
  ])
  // Invite-a-friend: a main photo may complete a pending referral (never throws).
  await maybeRewardReferral(userId)
}

/** Delete one of the user's photos (row + stored files). Returns false if not theirs. */
export async function deleteOwnPhoto(userId: string, photoId: string): Promise<boolean> {
  const photo = await db.photo.findUnique({ where: { id: photoId } })
  if (!photo || photo.userId !== userId) return false

  await db.$transaction(async (tx) => {
    await tx.photo.delete({ where: { id: photoId } })
    await tx.album.updateMany({ where: { coverPhotoId: photoId }, data: { coverPhotoId: null } })
    if (photo.isProfile) {
      await tx.profile.updateMany({ where: { userId }, data: { profilePhoto: null } })
    } else {
      // The main photo may also be referenced only by URL.
      await tx.profile.updateMany({ where: { userId, profilePhoto: photo.url }, data: { profilePhoto: null } })
    }
  })
  await deleteFiles(photoFileKeys(photo))
  return true
}
