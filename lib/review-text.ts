/**
 * Text hygiene for review comments and responses.
 *
 * Hush is an adult site: frank, explicit descriptions between consenting
 * adults are allowed (reviewers tick "Contains explicit details" so the text
 * is blurred until a viewer taps it). Swearing is allowed too. What we refuse:
 *  - Contact details / moving off Hush: phone numbers, emails, links and
 *    domains, social handles ("@name") and "add me on insta/WhatsApp/…".
 *  - Slurs and hate speech (a short list — general profanity is fine).
 *  - Anything involving minors.
 *  - Non-consent (drugged, passed out, "didn't consent", …) — those belong
 *    in a report to the safety team, not a review.
 *  - Health information such as STI / HIV status (special personal
 *    information under POPIA).
 * Naming third parties can't be detected reliably; the form guidelines cover it.
 *
 * Lists are deliberately small and conservative. Moderators handle the rest
 * through reports.
 */

/** Strip tags, control characters and excess whitespace. */
export function sanitizeText(raw: unknown, max = 2000): string {
  if (typeof raw !== 'string') return ''
  return raw
    .slice(0, max * 2)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿�]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim()
}

// ── Contact details ─────────────────────────────────────────────────────────

const EMAIL_RE = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9-]+(\.|\s+dot\s+)[a-z]{2,}/i
const URL_RE = /\b(https?:\/\/|www\.)\S+/i
// Bare domains such as "mysite.co.za" or "x.com/abc"
const DOMAIN_RE = /\b[a-z0-9-]{2,}\.(com|net|org|io|me|ly|app|info|biz|link|site|online|xyz|co|za|co\.za|org\.za)\b/i
// 9+ digits, optionally separated by spaces, dots, dashes or brackets (SA numbers are 10 digits)
const PHONE_RE = /(\+?\d[\s().-]*){9,}/
// "@thandi_x" — a handle (but not a lone "@"; emails are caught above)
const HANDLE_RE = /(^|[\s(])@[a-z0-9_.]{2,}/i
const SOCIAL_RE = /\b(insta|instagram|ig handle|whats\s?app|watsapp|wa\.me|telegram|signal me|snapchat|snap me|my snap|add me on|follow me on|onlyfans|only fans|tiktok|tik tok|facebook|fb me|twitter|linkedin|kik)\b/i

// ── Hate speech (short list; general swearing is allowed) ───────────────────

const SLURS = [
  'nigger', 'niggers', 'nigga', 'kaffir', 'kaffirs', 'kaffer', 'hotnot', 'coolie', 'faggot', 'faggots', 'fag', 'fags', 'moffie',
  'tranny', 'trannies', 'shemale', 'retard', 'retarded',
]

// ── Minors ──────────────────────────────────────────────────────────────────

// ("minor" alone is common — "a minor hiccup" — so only the plural, or "a minor" ending a clause)
const MINOR_RE = /\b(under\s?-?age(d)?|minors|schoolgirls?|schoolboys?|school\s+(girl|boy)s?|jailbait|loli|pre-?teens?)\b|\ba\s+minor\b(?=\s*([.,!?;)]|$))/i
// "16 years old", "15yo", "17 y/o", "aged 14" — any number under 18
const MINOR_AGE_RE = /\b(1[0-7]|[1-9])\s*(-|\s)?(years?\s*old|yrs?\s*old|y\/?o|yo)\b|\baged?\s+(1[0-7]|[1-9])\b/i

// ── Non-consent ─────────────────────────────────────────────────────────────

const NONCONSENT_RE = /\b(didn'?t\s+consent|did\s+not\s+consent|without\s+(my|her|his|their)?\s*consent|non-?\s?consensual|no\s+consent|against\s+(my|her|his|their)\s+will|drugged|spiked\s+(my|her|his|their)?\s*drinks?|passed\s+out|unconscious|forced\s+(me|her|him|them)|raped?|rapist|assaulted|sexual\s+assault|said\s+no\s+but|stealth(ed|ing)?)\b/i

// ── Health information (POPIA special personal information) ────────────────

const HEALTH_RE = /\b(hiv|std|stds|sti|stis|herpes|chlamydia|gonorrho?ea|syphilis|hpv|hep\s?[bc]|hepatitis|on\s+prep|arvs?|positive\s+status|poz)\b/i

/** Lowercase and undo common character swaps (f*ck, k4ffir) for slur matching. */
function normaliseForWords(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/(\w)[*.\-_](?=\w)/g, '$1')
}

function hasWord(text: string, words: string[]): boolean {
  const tokens = new Set(text.split(/[^a-z]+/).filter(Boolean))
  return words.some((w) => tokens.has(w))
}

export const SAFETY_HINT = 'If something unsafe happened, please report it from their profile or visit the Safety Centre (/safety) — our team will help.'

/**
 * Returns a user-facing reason the text can't be posted, or null when it's fine.
 * Run on sanitised text.
 */
export function reviewTextProblem(text: string): string | null {
  text = text.replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'")
  if (EMAIL_RE.test(text)) return 'Please remove the email address — reviews can’t include contact details.'
  if (URL_RE.test(text) || DOMAIN_RE.test(text)) return 'Please remove the link — reviews can’t include websites or links.'
  if (PHONE_RE.test(text)) return 'Please remove the phone number — reviews can’t include contact details.'
  if (HANDLE_RE.test(text) || SOCIAL_RE.test(text)) {
    return 'Please leave out social media handles and other apps — keep contact on Hush.'
  }
  if (MINOR_RE.test(text) || MINOR_AGE_RE.test(text)) {
    return 'Reviews can’t mention anyone under 18 or anything involving minors. ' + SAFETY_HINT
  }
  if (NONCONSENT_RE.test(text)) {
    return 'This sounds like it may not have been consensual. Please don’t put that in a review — ' + SAFETY_HINT
  }
  if (hasWord(normaliseForWords(text), SLURS)) return 'Please remove the slur. Hate speech isn’t allowed on Hush.'
  if (HEALTH_RE.test(text)) {
    return 'Please leave out health information such as STI or HIV status — it’s sensitive personal information and stays private.'
  }
  return null
}
