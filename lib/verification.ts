/**
 * Photo verification: the member takes a selfie copying a random pose, and an
 * admin compares it with their profile photos (/admin/verification). The pose
 * shows it's a live photo taken now, not one copied from somewhere else.
 */
export const VERIFICATION_POSES = [
  'Hold up three fingers next to your face',
  'Give a thumbs up next to your face',
  'Touch your nose with one finger',
  'Make a peace sign with your hand',
  'Put your hand flat on top of your head',
  'Cover one eye with your hand',
] as const

export type VerificationPose = (typeof VERIFICATION_POSES)[number]

export function isVerificationPose(v: unknown): v is VerificationPose {
  return typeof v === 'string' && (VERIFICATION_POSES as readonly string[]).includes(v)
}

export function randomPose(): VerificationPose {
  return VERIFICATION_POSES[Math.floor(Math.random() * VERIFICATION_POSES.length)]
}
