/**
 * Shared identity, preferences and "about me" option lists, labels,
 * validators and formatters. Pure module (no DB access) so it can be used
 * from server routes and client components alike.
 *
 * Privacy rules baked in here:
 *  - Hidden gender / orientation are still used for matching, but are
 *    stripped by `publicPerson()` before anything is shown to other members.
 *  - Ethnicity is optional, self-described, hidden by default and is NEVER
 *    used for matching, filtering, sorting, compatibility or picks.
 */

// ── Option lists ────────────────────────────────────────────────────────────

export type Gender = 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER'
export type Category = 'MAN' | 'WOMAN' | 'NON_BINARY' | 'COUPLE'
export type CoupleType = 'MF' | 'FF' | 'MM' | 'MX'

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
]

export const GENDER_LABEL_SUGGESTIONS = [
  'Trans woman', 'Trans man', 'Cis woman', 'Cis man', 'Genderqueer',
  'Genderfluid', 'Agender', 'Two-spirit', 'Intersex',
]

export const PRONOUN_OPTIONS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they']

export const ORIENTATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'STRAIGHT', label: 'Straight' },
  { value: 'GAY', label: 'Gay' },
  { value: 'LESBIAN', label: 'Lesbian' },
  { value: 'BISEXUAL', label: 'Bisexual' },
  { value: 'PANSEXUAL', label: 'Pansexual' },
  { value: 'QUEER', label: 'Queer' },
  { value: 'ASEXUAL', label: 'Asexual' },
  { value: 'QUESTIONING', label: 'Questioning' },
]

export const INTERESTED_IN_OPTIONS: { value: Category; label: string }[] = [
  { value: 'WOMAN', label: 'Women' },
  { value: 'MAN', label: 'Men' },
  { value: 'NON_BINARY', label: 'Non-binary people' },
  { value: 'COUPLE', label: 'Couples' },
]

export const INTENTION_OPTIONS: { value: string; label: string; phrase: string }[] = [
  { value: 'DATING', label: 'Dating', phrase: 'dating' },
  { value: 'RELATIONSHIP', label: 'A relationship', phrase: 'a relationship' },
  { value: 'FRIENDSHIP', label: 'Friendship', phrase: 'friendship' },
  { value: 'CASUAL', label: 'Something casual', phrase: 'something casual' },
  { value: 'COUPLES_PLAY', label: "Couples' play / ENM", phrase: "couples' play" },
  { value: 'EVENTS', label: 'Events & socials', phrase: 'events & socials' },
]

export const COUPLE_TYPE_OPTIONS: { value: CoupleType; label: string; badge: string }[] = [
  { value: 'MF', label: 'Woman & man', badge: 'MF couple' },
  { value: 'FF', label: 'Two women', badge: 'FF couple' },
  { value: 'MM', label: 'Two men', badge: 'MM couple' },
  { value: 'MX', label: 'Includes a non-binary partner', badge: 'MX couple' },
]

export const BODY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'SLIM', label: 'Slim' },
  { value: 'ATHLETIC', label: 'Athletic' },
  { value: 'AVERAGE', label: 'Average' },
  { value: 'CURVY', label: 'Curvy' },
  { value: 'MUSCULAR', label: 'Muscular' },
  { value: 'FULL_FIGURED', label: 'Full-figured' },
  { value: 'EXTRA', label: 'A few extra kilos' },
]

export const DRINKING_OPTIONS: { value: string; label: string }[] = [
  { value: 'NEVER', label: "Don't drink" },
  { value: 'SOCIALLY', label: 'Socially' },
  { value: 'REGULARLY', label: 'Regularly' },
]

export const SMOKING_OPTIONS: { value: string; label: string }[] = [
  { value: 'NEVER', label: "Don't smoke" },
  { value: 'SOCIALLY', label: 'Socially' },
  { value: 'REGULARLY', label: 'Regularly' },
  { value: 'QUITTING', label: 'Trying to quit' },
]

export const CHILDREN_OPTIONS: { value: string; label: string }[] = [
  { value: 'NONE', label: 'No children' },
  { value: 'AT_HOME', label: 'Have children at home' },
  { value: 'NOT_AT_HOME', label: "Have children, not at home" },
]

export const LANGUAGE_OPTIONS = [
  'English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana', 'Sepedi',
  'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele', 'Portuguese', 'French',
  'Shona', 'Swahili', 'German', 'Dutch', 'Hindi', 'Arabic', 'Mandarin', 'Spanish',
]

/** A respectful list; anything else is stored as the person typed it. */
export const ETHNICITY_SUGGESTIONS = [
  'Black African', 'Coloured', 'Indian', 'Asian', 'White', 'Mixed / multiracial',
]

export const ETHNICITY_NOTE = 'Optional. Only shown if you choose. Never used to filter or rank.'

// ── Formatters ──────────────────────────────────────────────────────────────

function labelFrom(list: { value: string; label: string }[], value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return list.find((o) => o.value === value)?.label
}

export function genderLabelOf(gender: string | null | undefined): string | undefined {
  if (gender === 'OTHER') return 'Non-binary'
  return labelFrom(GENDER_OPTIONS, gender)
}

/** Known codes get a label; legacy "OTHER" and self-described text pass through. */
export function orientationLabelOf(orientation: string | null | undefined): string | undefined {
  if (!orientation) return undefined
  if (orientation === 'OTHER') return 'Other'
  return labelFrom(ORIENTATION_OPTIONS, orientation) ?? orientation
}

export const bodyTypeLabelOf = (v?: string | null) => labelFrom(BODY_TYPE_OPTIONS, v)
export const drinkingLabelOf = (v?: string | null) => labelFrom(DRINKING_OPTIONS, v)
export const smokingLabelOf = (v?: string | null) => labelFrom(SMOKING_OPTIONS, v)
export const childrenLabelOf = (v?: string | null) => labelFrom(CHILDREN_OPTIONS, v)
export const intentionLabelOf = (v?: string | null) => labelFrom(INTENTION_OPTIONS, v)
export const interestedInLabelOf = (v?: string | null) => labelFrom(INTERESTED_IN_OPTIONS, v)

export function coupleTypeBadge(t: string | null | undefined): string | undefined {
  return COUPLE_TYPE_OPTIONS.find((o) => o.value === t)?.badge
}

/** 170 → `5'7"` */
export function cmToFtIn(cm: number | null | undefined): string | undefined {
  if (!cm || !Number.isFinite(cm)) return undefined
  const totalIn = Math.round(cm / 2.54)
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`
}

export function heightLabel(cm: number | null | undefined): string | undefined {
  const ft = cmToFtIn(cm)
  return ft ? `${cm} cm (${ft})` : undefined
}

export function ageFrom(dob: Date | string | null | undefined): number | undefined {
  if (!dob) return undefined
  const d = new Date(dob)
  if (isNaN(d.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export function isAdult(dob: Date | string | null | undefined): boolean {
  const a = ageFrom(dob)
  return a !== undefined && a >= 18 && a <= 120
}

// ── Matching ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = ['MAN', 'WOMAN', 'NON_BINARY', 'COUPLE']
const LEGACY_WHO = ['MAN', 'WOMAN', 'COUPLE', 'ANY']

/** What kind of member someone is, for "who would like to meet whom". */
export function categoryOf(p: { isCouple?: boolean | null; gender?: string | null }): Category | null {
  if (p.isCouple) return 'COUPLE'
  if (p.gender === 'MAN' || p.gender === 'WOMAN') return p.gender
  if (p.gender === 'NON_BINARY' || p.gender === 'OTHER') return 'NON_BINARY'
  return null
}

/**
 * Who someone would like to meet. `interestedIn` wins; otherwise the legacy
 * `lookingFor` (MAN/WOMAN/COUPLE/ANY) is used. Returns [] for "no preference".
 */
export function effectiveInterestedIn(p: { interestedIn?: string[] | null; lookingFor?: string[] | null }): Category[] {
  const ii = (p.interestedIn ?? []).filter((v): v is Category => (CATEGORIES as string[]).includes(v))
  if (ii.length) return ii
  const lf = (p.lookingFor ?? []).filter((v) => LEGACY_WHO.includes(v))
  if (!lf.length || lf.includes('ANY')) return []
  return lf.filter((v): v is Category => (CATEGORIES as string[]).includes(v))
}

/** Does `who` (a preference list; [] = open to everyone) include `cat`? */
function wants(who: Category[], cat: Category | null): boolean {
  if (!who.length || !cat) return true
  return who.includes(cat)
}

export interface MatchSide {
  isCouple?: boolean | null
  gender?: string | null
  interestedIn?: string[] | null
  lookingFor?: string[] | null
}

/** Both sides would like to meet each other (permissive when preferences are unset). */
export function isMutualInterest(a: MatchSide, b: MatchSide): boolean {
  return wants(effectiveInterestedIn(a), categoryOf(b)) && wants(effectiveInterestedIn(b), categoryOf(a))
}

/** Lookup used for legacy-only (lookingFor) candidates in DB queries. */
export function legacyValuesWanting(cat: Category): string[] {
  return cat === 'NON_BINARY' ? ['ANY'] : ['ANY', cat]
}
export const LEGACY_WHO_VALUES = LEGACY_WHO

export function deriveCoupleType(g1: string | null | undefined, g2: string | null | undefined): CoupleType | null {
  if (!g1 || !g2) return null
  const nb = (g: string) => g === 'NON_BINARY' || g === 'OTHER'
  if (nb(g1) || nb(g2)) return 'MX'
  if (g1 === 'MAN' && g2 === 'MAN') return 'MM'
  if (g1 === 'WOMAN' && g2 === 'WOMAN') return 'FF'
  return 'MF'
}

// ── Couple members (Json) ───────────────────────────────────────────────────

export interface PersonDetails {
  name?: string
  gender?: Gender
  genderLabel?: string
  pronouns?: string
  dateOfBirth?: string // YYYY-MM-DD
  orientation?: string
  showGender?: boolean
  showOrientation?: boolean
  heightCm?: number
  bodyType?: string
  ethnicity?: string
  showEthnicity?: boolean
  languages?: string[]
  drinking?: string
  smoking?: string
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max)
  return t || undefined
}
const inList = (v: unknown, list: { value: string }[]): string | undefined =>
  typeof v === 'string' && list.some((o) => o.value === v) ? v : undefined

function toDateString(v: unknown): string | undefined {
  if (typeof v !== 'string' && !(v instanceof Date)) return undefined
  const d = new Date(v)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

/** Lenient parse of stored Json (never throws, drops unknown keys). */
export function parseCoupleMembers(raw: unknown): PersonDetails[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 2).map((m) => cleanPerson(m).person)
}

export function cleanPerson(raw: unknown): { person: PersonDetails; error?: string } {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const person: PersonDetails = {}
  let error: string | undefined
  const name = str(m.name, 40); if (name) person.name = name
  const gender = typeof m.gender === 'string' && ['MAN', 'WOMAN', 'NON_BINARY', 'OTHER'].includes(m.gender) ? (m.gender as Gender) : undefined
  if (gender) person.gender = gender
  const gl = str(m.genderLabel, 40); if (gl) person.genderLabel = gl
  const pr = str(m.pronouns, 30); if (pr) person.pronouns = pr
  const dob = toDateString(m.dateOfBirth)
  if (dob) {
    if (!isAdult(dob)) error = 'Everyone on Hush must be 18 or older'
    else person.dateOfBirth = dob
  }
  const o = str(m.orientation, 40); if (o) person.orientation = o
  if (typeof m.showGender === 'boolean') person.showGender = m.showGender
  if (typeof m.showOrientation === 'boolean') person.showOrientation = m.showOrientation
  const h = typeof m.heightCm === 'number' ? Math.round(m.heightCm) : typeof m.heightCm === 'string' ? parseInt(m.heightCm, 10) : NaN
  if (Number.isFinite(h) && h >= 120 && h <= 230) person.heightCm = h
  const bt = inList(m.bodyType, BODY_TYPE_OPTIONS); if (bt) person.bodyType = bt
  const eth = str(m.ethnicity, 40); if (eth) person.ethnicity = eth
  person.showEthnicity = m.showEthnicity === true && !!eth
  if (Array.isArray(m.languages)) {
    const langs = m.languages.map((l) => str(l, 30)).filter((l): l is string => !!l)
    if (langs.length) person.languages = Array.from(new Set(langs)).slice(0, 8)
  }
  const dr = inList(m.drinking, DRINKING_OPTIONS); if (dr) person.drinking = dr
  const sm = inList(m.smoking, SMOKING_OPTIONS); if (sm) person.smoking = sm
  return { person, error }
}

/** What other members may see about a person (hidden fields removed). */
export interface PublicPerson {
  name?: string
  age?: number
  gender?: string        // label, e.g. "Woman"
  genderLabel?: string   // self-described, e.g. "Trans woman"
  pronouns?: string
  orientation?: string   // label
  height?: string
  bodyType?: string
  ethnicity?: string
  languages?: string[]
  drinking?: string
  smoking?: string
  username?: string      // linked partner account
}

export function publicPerson(p: PersonDetails & { dateOfBirth?: string | Date | null }): PublicPerson {
  const out: PublicPerson = {}
  if (p.name) out.name = p.name
  const age = ageFrom(p.dateOfBirth ?? null); if (age !== undefined) out.age = age
  if (p.showGender !== false) {
    const g = genderLabelOf(p.gender); if (g) out.gender = g
    if (p.genderLabel) out.genderLabel = p.genderLabel
  }
  if (p.pronouns) out.pronouns = p.pronouns
  if (p.showOrientation !== false) {
    const o = orientationLabelOf(p.orientation); if (o) out.orientation = o
  }
  const h = heightLabel(p.heightCm); if (h) out.height = h
  const bt = bodyTypeLabelOf(p.bodyType); if (bt) out.bodyType = bt
  if (p.showEthnicity === true && p.ethnicity) out.ethnicity = p.ethnicity
  if (p.languages?.length) out.languages = p.languages
  const dr = drinkingLabelOf(p.drinking); if (dr) out.drinking = dr
  const sm = smokingLabelOf(p.smoking); if (sm) out.smoking = sm
  return out
}

/** Profile row → PersonDetails (for an individual, or partner 1 of a couple). */
export function personFromProfile(p: {
  displayName?: string | null; gender?: string | null; genderLabel?: string | null; pronouns?: string | null
  dateOfBirth?: Date | string | null; orientation?: string | null; showGender?: boolean | null
  showOrientation?: boolean | null; heightCm?: number | null; bodyType?: string | null
  ethnicity?: string | null; showEthnicity?: boolean | null; languages?: string[] | null
  drinking?: string | null; smoking?: string | null
}): PersonDetails {
  return {
    name: p.displayName ?? undefined,
    gender: (p.gender as Gender | null) ?? undefined,
    genderLabel: p.genderLabel ?? undefined,
    pronouns: p.pronouns ?? undefined,
    dateOfBirth: p.dateOfBirth ? toDateString(p.dateOfBirth) : undefined,
    orientation: p.orientation ?? undefined,
    showGender: p.showGender ?? true,
    showOrientation: p.showOrientation ?? true,
    heightCm: p.heightCm ?? undefined,
    bodyType: p.bodyType ?? undefined,
    ethnicity: p.ethnicity ?? undefined,
    showEthnicity: !!p.showEthnicity,
    languages: p.languages ?? [],
    drinking: p.drinking ?? undefined,
    smoking: p.smoking ?? undefined,
  }
}

// ── Input validation for profile / onboarding updates ───────────────────────

export interface ExistingForValidation {
  dateOfBirth?: Date | null
  isCouple?: boolean
  partnerId?: string | null
  gender?: string | null
}

/**
 * Validates the identity / preferences / about-me part of a profile update.
 * Only keys present in `body` are written. Returns Prisma-ready data.
 */
export function parseIdentityInput(
  body: Record<string, unknown>,
  existing: ExistingForValidation,
): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
  const nullable = (k: string, v: unknown) => (v === null || v === '' ? null : v)

  if (has('isCouple')) {
    if (typeof body.isCouple !== 'boolean') return { error: 'isCouple must be true or false' }
    if (!body.isCouple && existing.partnerId) return { error: 'Unlink your partner first to switch to a single profile' }
    data.isCouple = body.isCouple
    if (!body.isCouple) { data.coupleMembers = null; data.coupleType = null }
  }
  const isCouple = (data.isCouple as boolean | undefined) ?? !!existing.isCouple

  if (has('gender')) {
    const g = nullable('gender', body.gender)
    if (g !== null && !(typeof g === 'string' && ['MAN', 'WOMAN', 'NON_BINARY', 'OTHER'].includes(g))) return { error: 'Invalid gender' }
    data.gender = g
  }
  if (has('genderLabel')) data.genderLabel = str(body.genderLabel, 40) ?? null
  if (has('pronouns')) data.pronouns = str(body.pronouns, 30) ?? null
  if (has('orientation')) data.orientation = str(body.orientation, 40) ?? null
  for (const k of ['showGender', 'showOrientation', 'showEthnicity'] as const) {
    if (has(k)) {
      if (typeof body[k] !== 'boolean') return { error: `${k} must be true or false` }
      data[k] = body[k]
    }
  }
  if (has('interestedIn')) {
    if (!Array.isArray(body.interestedIn)) return { error: 'interestedIn must be a list' }
    const v = Array.from(new Set(body.interestedIn.filter((x): x is Category => (CATEGORIES as unknown[]).includes(x))))
    data.interestedIn = v
    // Backward compatibility: lookingFor historically held the "who".
    data.lookingFor = v
  }
  if (has('intentions')) {
    if (!Array.isArray(body.intentions)) return { error: 'intentions must be a list' }
    data.intentions = Array.from(new Set(body.intentions.filter((x): x is string => INTENTION_OPTIONS.some((o) => o.value === x))))
  }
  if (has('coupleType')) {
    const t = nullable('coupleType', body.coupleType)
    if (t !== null && !COUPLE_TYPE_OPTIONS.some((o) => o.value === t)) return { error: 'Invalid couple type' }
    data.coupleType = t
  }
  if (has('heightCm')) {
    const h = body.heightCm === null || body.heightCm === '' ? null : Number(body.heightCm)
    if (h !== null && (!Number.isFinite(h) || h < 120 || h > 230)) return { error: 'Height must be between 120 and 230 cm' }
    data.heightCm = h === null ? null : Math.round(h)
  }
  if (has('bodyType')) data.bodyType = inList(body.bodyType, BODY_TYPE_OPTIONS) ?? null
  if (has('drinking')) data.drinking = inList(body.drinking, DRINKING_OPTIONS) ?? null
  if (has('smoking')) data.smoking = inList(body.smoking, SMOKING_OPTIONS) ?? null
  if (has('hasChildren')) data.hasChildren = inList(body.hasChildren, CHILDREN_OPTIONS) ?? null
  if (has('ethnicity')) {
    data.ethnicity = str(body.ethnicity, 40) ?? null
    if (data.ethnicity === null) data.showEthnicity = false
  }
  if (has('languages')) {
    if (!Array.isArray(body.languages)) return { error: 'languages must be a list' }
    data.languages = Array.from(new Set(body.languages.map((l) => str(l, 30)).filter((l): l is string => !!l))).slice(0, 8)
  }

  if (has('coupleMembers') && body.coupleMembers !== null) {
    if (!isCouple) return { error: 'Partner details are only for couple profiles' }
    if (!Array.isArray(body.coupleMembers) || body.coupleMembers.length > 2) return { error: 'coupleMembers must be a list of up to two people' }
    const members: PersonDetails[] = []
    for (const raw of body.coupleMembers) {
      const { person, error } = cleanPerson(raw)
      if (error) return { error }
      members.push(person)
    }
    // Partner 1 is the account holder: their date of birth is the verified one from sign-up.
    if (members[0]) {
      const dob = existing.dateOfBirth ? existing.dateOfBirth.toISOString().slice(0, 10) : undefined
      if (dob) members[0].dateOfBirth = dob
      else delete members[0].dateOfBirth
      // Mirror partner 1 into the main profile fields (used for matching & legacy readers).
      const p1 = members[0]
      if (p1.gender) data.gender = p1.gender
      data.genderLabel = p1.genderLabel ?? null
      data.pronouns = p1.pronouns ?? null
      data.orientation = p1.orientation ?? null
      data.showGender = p1.showGender ?? true
      data.showOrientation = p1.showOrientation ?? true
      data.heightCm = p1.heightCm ?? null
      data.bodyType = p1.bodyType ?? null
      data.ethnicity = p1.ethnicity ?? null
      data.showEthnicity = !!p1.showEthnicity
      data.languages = p1.languages ?? []
      data.drinking = p1.drinking ?? null
      data.smoking = p1.smoking ?? null
    }
    data.coupleMembers = members
    if (!has('coupleType') && members[0]?.gender && members[1]?.gender) {
      data.coupleType = deriveCoupleType(members[0].gender, members[1].gender)
    }
  } else if (has('coupleMembers')) {
    data.coupleMembers = null
  }

  return { data }
}

// ── Profile completeness (single source of truth) ───────────────────────────

export const COMPLETENESS_FIELDS = [
  'displayName', 'bio', 'dateOfBirth', 'gender', 'orientation',
  'interestedIn', 'city', 'country', 'profilePhoto',
] as const
export type CompletenessField = typeof COMPLETENESS_FIELDS[number]

export function completenessOf(
  p: Record<string, unknown> | null | undefined,
  hasPhoto = false,
): { completeness: number; missing: CompletenessField[] } {
  const prof = p ?? {}
  const filled = (f: CompletenessField): boolean => {
    if (f === 'profilePhoto') return hasPhoto || !!prof.profilePhoto
    if (f === 'interestedIn') {
      const ii = prof.interestedIn, lf = prof.lookingFor
      return (Array.isArray(ii) && ii.length > 0) || (Array.isArray(lf) && lf.length > 0)
    }
    const v = prof[f]
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v)) return v.length > 0
    return true
  }
  const missing = COMPLETENESS_FIELDS.filter((f) => !filled(f))
  return {
    completeness: Math.round(((COMPLETENESS_FIELDS.length - missing.length) / COMPLETENESS_FIELDS.length) * 100),
    missing,
  }
}

// ── Public view of a whole profile (for other members) ──────────────────────

type ProfileLike = Parameters<typeof personFromProfile>[0]

export interface PublicIdentity {
  isCouple: boolean
  coupleType?: string
  coupleBadge?: string
  /** Individuals: the person. Couples: partner 1 & partner 2. */
  people: PublicPerson[]
  ages: number[]
  /** Labels; omitted when the member hides their orientation (it would reveal it). */
  interestedIn?: string[]
  intentions: string[]
  children?: string
}

export function publicIdentity(
  p: ProfileLike & {
    isCouple?: boolean | null; coupleType?: string | null; coupleMembers?: unknown
    interestedIn?: string[] | null; lookingFor?: string[] | null; intentions?: string[] | null
    hasChildren?: string | null
  },
  partner?: (ProfileLike & { username?: string | null }) | null,
): PublicIdentity {
  let people: PublicPerson[]
  if (p.isCouple && partner) {
    people = [publicPerson(personFromProfile(p)), { ...publicPerson(personFromProfile(partner)), ...(partner.username ? { username: partner.username } : {}) }]
  } else if (p.isCouple) {
    const members = parseCoupleMembers(p.coupleMembers)
    people = members.length
      ? members.map((m, i) => publicPerson(i === 0 ? { ...m, dateOfBirth: p.dateOfBirth ? toDateString(p.dateOfBirth) : m.dateOfBirth } : m))
      : [publicPerson(personFromProfile(p))]
    if (people[0] && !members[0]?.name) delete people[0].name
  } else {
    people = [publicPerson(personFromProfile(p))]
  }
  const who = effectiveInterestedIn(p)
  return {
    isCouple: !!p.isCouple,
    ...(p.isCouple && p.coupleType ? { coupleType: p.coupleType, coupleBadge: coupleTypeBadge(p.coupleType) } : {}),
    people,
    ages: people.map((x) => x.age).filter((a): a is number => a !== undefined),
    ...(p.showOrientation !== false && who.length
      ? { interestedIn: who.map((c) => interestedInLabelOf(c)).filter((l): l is string => !!l) }
      : {}),
    intentions: (p.intentions ?? []).map((i) => intentionLabelOf(i)).filter((l): l is string => !!l),
    ...(childrenLabelOf(p.hasChildren) ? { children: childrenLabelOf(p.hasChildren) } : {}),
  }
}
