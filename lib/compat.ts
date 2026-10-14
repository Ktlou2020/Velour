import { distanceKm } from '@/lib/geo'

export interface CompatInput {
  interests: string[]
  lookingFor: string[]
  age?: number | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface CompatResult {
  score: number
  reasons: string[]
  sharedInterests: string[]
}

/**
 * Transparent compatibility score (0–100) built from shared interests,
 * overlapping goals, age gap and proximity. Deterministic, no external calls.
 */
export function compatibility(a: CompatInput, b: CompatInput): CompatResult {
  const reasons: string[] = []

  const aInterests = new Set(a.interests.map((i) => i.toLowerCase()))
  const sharedInterests = b.interests.filter((i) => aInterests.has(i.toLowerCase()))
  const interestPool = Math.max(Math.min(a.interests.length, b.interests.length), 1)
  const interestScore = Math.min(sharedInterests.length / interestPool, 1) * 40
  if (sharedInterests.length > 0) {
    reasons.push(`${sharedInterests.length} shared interest${sharedInterests.length === 1 ? '' : 's'}`)
  }

  const aGoals = new Set(a.lookingFor)
  const sharedGoals = b.lookingFor.filter((g) => aGoals.has(g))
  const goalScore = a.lookingFor.length && b.lookingFor.length
    ? Math.min(sharedGoals.length / Math.min(a.lookingFor.length, b.lookingFor.length), 1) * 30
    : 10
  if (sharedGoals.length > 0) reasons.push('Looking for the same things')

  let ageScore = 8
  if (a.age && b.age) {
    const gap = Math.abs(a.age - b.age)
    ageScore = gap <= 3 ? 15 : gap <= 7 ? 11 : gap <= 12 ? 6 : 2
    if (gap <= 5) reasons.push('Similar age')
  }

  let placeScore = 0
  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    const km = distanceKm(a.latitude, a.longitude, b.latitude, b.longitude)
    placeScore = km < 10 ? 15 : km < 30 ? 12 : km < 80 ? 8 : km < 250 ? 4 : 1
    if (km < 30) reasons.push('Lives nearby')
  } else if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
    placeScore = 12
    reasons.push('Same city')
  }

  const score = Math.round(Math.min(interestScore + goalScore + ageScore + placeScore, 100))
  return { score, reasons, sharedInterests }
}

export function ageFromDob(dob: Date | string | null | undefined): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}
