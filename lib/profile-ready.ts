import { db } from '@/lib/db'

/**
 * A profile is "ready" once it has the basics other members need before
 * saying hello: a name, a gender (or a couple profile), who they'd like to
 * meet, a city and a main photo. Until then a member can finish onboarding
 * and edit their profile, but can't browse or message (middleware.ts sends
 * them to /onboarding; the messaging APIs refuse). Admins are always ready.
 */
export const profileReadySelect = {
  displayName: true,
  gender: true,
  isCouple: true,
  interestedIn: true,
  lookingFor: true,
  city: true,
  profilePhoto: true,
} as const

type ReadyFields = {
  displayName: string | null
  gender: string | null
  isCouple: boolean
  interestedIn: string[] | null
  lookingFor: string[] | null
  city: string | null
  profilePhoto: string | null
}

export function isProfileReady(role: string | null | undefined, profile: ReadyFields | null | undefined): boolean {
  if (role === 'ADMIN') return true
  if (!profile) return false
  return (
    !!profile.displayName?.trim() &&
    (profile.isCouple || !!profile.gender) &&
    ((profile.interestedIn?.length ?? 0) > 0 || (profile.lookingFor?.length ?? 0) > 0) &&
    !!profile.city?.trim() &&
    !!profile.profilePhoto
  )
}

export async function userProfileReady(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, profile: { select: profileReadySelect } } })
  return !!u && isProfileReady(u.role, u.profile)
}

export const PROFILE_NOT_READY_ERROR = 'Finish your profile (basics and a photo) before messaging.'
