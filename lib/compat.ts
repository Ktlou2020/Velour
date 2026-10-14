import { distanceKm } from '@/lib/geo'
import { INTENTION_OPTIONS, type Category } from '@/lib/identity'

/**
 * Inputs for the compatibility score. Deliberately contains no ethnicity,
 * body type or other "about me" details: those are never used to rank people.
 */
export interface CompatInput {
  interests: string[]
  /** What kind of member this is (MAN / WOMAN / NON_BINARY / COUPLE), if known. */
  category?: Category | null
  /** Who they'd like to meet ([] = open to everyone). Use effectiveInterestedIn(). */
  interestedIn?: Category[]
  /** Why they're here, e.g. DATING, FRIENDSHIP. */
  intentions?: string[]
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

function wants(who: Category[] | undefined, cat: Category | null | undefined): 'yes' | 'open' | 'no' {
  if (!who || who.length === 0 || !cat) return 'open'
  return who.includes(cat) ? 'yes' : 'no'
}

function intentionPhrase(values: string[]): string {
  const phrases = values.map((v) => INTENTION_OPTIONS.find((o) => o.value === v)?.phrase ?? v.toLowerCase())
  if (phrases.length === 1) return phrases[0]
  return `${phrases.slice(0, -1).join(', ')} & ${phrases[phrases.length - 1]}`
}

/**
 * Transparent compatibility score (0–100): shared interests (35), mutual
 * interest in each other (20), shared intentions (15), age gap (15) and
 * proximity (15). Deterministic, no external calls.
 */
export function compatibility(a: CompatInput, b: CompatInput): CompatResult {
  const reasons: string[] = []

  // Mutual interest first: it is the most meaningful reason.
  const aWantsB = wants(a.interestedIn, b.category)
  const bWantsA = wants(b.interestedIn, a.category)
  let mutualScore = 0
  if (aWantsB !== 'no' && bWantsA !== 'no') {
    if (aWantsB === 'yes' && bWantsA === 'yes') {
      mutualScore = 20
      reasons.push('Mutual interest')
    } else {
      mutualScore = 12
    }
  }

  const aIntent = new Set(a.intentions ?? [])
  const sharedIntentions = (b.intentions ?? []).filter((i) => aIntent.has(i))
  let intentScore = 5
  if ((a.intentions?.length ?? 0) && (b.intentions?.length ?? 0)) {
    intentScore = Math.min(sharedIntentions.length / Math.min(a.intentions!.length, b.intentions!.length), 1) * 15
  }
  if (sharedIntentions.length > 0) {
    reasons.push(`You're both looking for ${intentionPhrase(sharedIntentions.slice(0, 2))}`)
  }

  const aInterests = new Set(a.interests.map((i) => i.toLowerCase()))
  const sharedInterests = b.interests.filter((i) => aInterests.has(i.toLowerCase()))
  const interestPool = Math.max(Math.min(a.interests.length, b.interests.length), 1)
  const interestScore = Math.min(sharedInterests.length / interestPool, 1) * 35
  if (sharedInterests.length > 0) {
    reasons.push(`${sharedInterests.length} shared interest${sharedInterests.length === 1 ? '' : 's'}`)
  }

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

  const score = Math.round(Math.min(interestScore + mutualScore + intentScore + ageScore + placeScore, 100))
  return { score, reasons, sharedInterests }
}

export function ageFromDob(dob: Date | string | null | undefined): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}
