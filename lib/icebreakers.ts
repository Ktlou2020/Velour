/**
 * Generates suggested first messages ("icebreakers") from the other person's
 * profile. Pure function — no DB access — so it can run on server or client.
 */

export interface IcebreakerProfile {
  displayName?: string | null
  city?: string | null
  bio?: string | null
  interests?: string[]
  prompts?: unknown // Profile.prompts Json: [{ question, answer }]
}

const GENERIC = [
  "Hey! Your profile caught my eye — what's something that always makes your week better?",
  'Hi there! If we grabbed a drink tonight, where would you take me?',
  "Hello! What's the most spontaneous thing you've done lately?",
  "Hey — I'm curious, what does a perfect Sunday look like for you?",
  'Hi! What are you looking forward to most this month?',
]

// Words in a bio that make for a natural conversation hook.
const BIO_KEYWORDS: { re: RegExp; line: (w: string) => string }[] = [
  { re: /\b(travel(?:l?ing)?|wanderlust|adventure)\b/i, line: () => "Your bio says you love to travel — what's the best place you've been so far?" },
  { re: /\b(cook(?:ing)?|chef|foodie|food)\b/i, line: () => "A fellow food lover! What's your signature dish?" },
  { re: /\b(wine|cocktails?|whisk(?:e)?y)\b/i, line: (w) => `I see ${w.toLowerCase()} in your bio — any favourites I should try?` },
  { re: /\b(dance|dancing)\b/i, line: () => 'You mentioned dancing — where do you go to dance around here?' },
  { re: /\b(music|concerts?|festivals?)\b/i, line: () => 'What was the last live show you went to?' },
  { re: /\b(gym|fitness|yoga|running|hiking)\b/i, line: (w) => `${cap(w)} fan? Morning or evening person?` },
  { re: /\b(books?|reading|reader)\b/i, line: () => "What's the best book you've read this year?" },
  { re: /\b(art|painting|photography)\b/i, line: (w) => `Your bio mentions ${w.toLowerCase()} — I'd love to hear more about that.` },
]

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function trimAnswer(a: string, max = 60) {
  const t = a.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

function parsePrompts(raw: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is { question: string; answer: string } =>
      !!p && typeof p === 'object' &&
      typeof (p as { question?: unknown }).question === 'string' &&
      typeof (p as { answer?: unknown }).answer === 'string' &&
      (p as { answer: string }).answer.trim().length > 0)
}

/** Simple deterministic hash so suggestions are stable for a given person. */
function seedOf(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function generateIcebreakers(
  other: IcebreakerProfile,
  me: { interests?: string[]; city?: string | null } = {},
  count = 3,
): string[] {
  const out: string[] = []
  const push = (s: string) => {
    if (out.length < count && !out.includes(s)) out.push(s)
  }

  const otherInterests = other.interests ?? []
  const mine = new Set((me.interests ?? []).map((i) => i.toLowerCase()))
  const shared = otherInterests.filter((i) => mine.has(i.toLowerCase()))

  // 1. Shared interest is the strongest hook
  if (shared.length > 0) {
    push(`We both love ${shared[0].toLowerCase()}! How did you get into it?`)
  }

  // 2. Their profile prompts
  const prompts = parsePrompts(other.prompts)
  if (prompts.length > 0) {
    const p = prompts[seedOf(other.displayName ?? '') % prompts.length]
    push(`"${trimAnswer(p.answer)}" — okay, I need the story behind that answer.`)
  }

  // 3. City
  if (other.city) {
    if (me.city && me.city.toLowerCase() === other.city.toLowerCase()) {
      push(`Fellow ${other.city} local! What's your favourite hidden spot in town?`)
    } else {
      push(`What's one thing in ${other.city} everyone should experience at least once?`)
    }
  }

  // 4. Bio keywords
  if (other.bio) {
    for (const { re, line } of BIO_KEYWORDS) {
      const m = other.bio.match(re)
      if (m) { push(line(m[1] ?? m[0])); break }
    }
  }

  // 5. One of their (non-shared) interests
  const theirs = otherInterests.filter((i) => !shared.includes(i))
  if (theirs.length > 0) {
    push(`I noticed you're into ${theirs[0].toLowerCase()} — what do you enjoy most about it?`)
  }

  // 6. Second prompt, if any
  if (prompts.length > 1) {
    const p = prompts[(seedOf(other.displayName ?? '') + 1) % prompts.length]
    push(`Loved your answer to "${trimAnswer(p.question, 50)}" — tell me more!`)
  }

  // 7. Generic fallbacks
  const start = seedOf(other.displayName ?? 'x') % GENERIC.length
  for (let i = 0; i < GENERIC.length && out.length < count; i++) {
    push(GENERIC[(start + i) % GENERIC.length])
  }

  return out
}
