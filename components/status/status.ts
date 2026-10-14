/**
 * Status ("Free tonight 🍷") — presets, durations and validation.
 * Pure module: used by app/api/profile (validation) and the status UI.
 */
import { startOfDaySAST } from '@/lib/plans'

export const STATUS_TEXT_MAX = 40

export const STATUS_PRESETS: { emoji: string; text: string }[] = [
  { emoji: '🍷', text: 'Free tonight' },
  { emoji: '☕', text: 'Up for coffee' },
  { emoji: '🎟️', text: 'Looking for an event buddy' },
  { emoji: '👀', text: 'Just browsing' },
  { emoji: '🌅', text: 'Weekend plans?' },
  { emoji: '🧭', text: 'New in town' },
]

/** Emoji choices offered for a custom status. */
export const STATUS_EMOJIS = ['🍷', '☕', '🎟️', '👀', '🌅', '🧭', '✨', '🎶', '🌊', '🍽️', '💃', '📚', '🏖️', '🔥', '🌙', '🤍']

export type StatusDuration = 'tonight' | '24h' | '3d'

export const STATUS_DURATIONS: { value: StatusDuration; label: string }[] = [
  { value: 'tonight', label: 'Until midnight' },
  { value: '24h', label: '24 hours' },
  { value: '3d', label: '3 days' },
]

const HOUR = 60 * 60 * 1000

export function statusUntilFor(duration: StatusDuration, now = new Date()): Date {
  if (duration === '24h') return new Date(now.getTime() + 24 * HOUR)
  if (duration === '3d') return new Date(now.getTime() + 72 * HOUR)
  // Tonight = next midnight SAST. Within the last hour of the day, give it an hour.
  const midnight = new Date(startOfDaySAST(now).getTime() + 24 * HOUR)
  return midnight.getTime() - now.getTime() < HOUR ? new Date(now.getTime() + HOUR) : midnight
}

export interface ActiveStatus {
  emoji: string | null
  text: string
  until: string
}

/** The status to show, or null when unset / expired. */
export function activeStatus(p: { statusText?: string | null; statusEmoji?: string | null; statusUntil?: Date | string | null } | null | undefined, now = new Date()): ActiveStatus | null {
  if (!p?.statusText || !p.statusUntil) return null
  const until = new Date(p.statusUntil)
  if (isNaN(until.getTime()) || until <= now) return null
  return { emoji: p.statusEmoji ?? null, text: p.statusText, until: until.toISOString() }
}

export function cleanStatusText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t || null
}

const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u
const PICTO_RE = /\p{Extended_Pictographic}/u

export function isValidStatusEmoji(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 16 && EMOJI_RE.test(v) && PICTO_RE.test(v)
}

/**
 * Validate `{ status: { emoji, text, duration } | null }` from a profile update.
 * Returns Prisma-ready fields.
 */
export function parseStatusInput(raw: unknown, now = new Date()):
  | { data: { statusText: string | null; statusEmoji: string | null; statusUntil: Date | null } }
  | { error: string } {
  if (raw === null) return { data: { statusText: null, statusEmoji: null, statusUntil: null } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Invalid status' }
  const { emoji, text, duration } = raw as { emoji?: unknown; text?: unknown; duration?: unknown }
  const cleaned = cleanStatusText(text)
  if (!cleaned) return { error: 'Write a short status first' }
  if (cleaned.length > STATUS_TEXT_MAX) return { error: `Keep your status under ${STATUS_TEXT_MAX} characters` }
  if (/(https?:\/\/|www\.)\S+/i.test(cleaned)) return { error: 'Links aren’t allowed in your status' }
  if (emoji !== undefined && emoji !== null && emoji !== '' && !isValidStatusEmoji(emoji)) return { error: 'Pick an emoji for your status' }
  const d = typeof duration === 'string' && STATUS_DURATIONS.some((o) => o.value === duration) ? (duration as StatusDuration) : null
  if (!d) return { error: 'Choose how long to show your status' }
  return {
    data: {
      statusText: cleaned,
      statusEmoji: typeof emoji === 'string' && emoji ? emoji : null,
      statusUntil: statusUntilFor(d, now),
    },
  }
}

/** "until midnight", "for 5 more hours", "until Fri" */
export function statusTimeLeft(untilIso: string, now = new Date()): string {
  const ms = new Date(untilIso).getTime() - now.getTime()
  if (ms <= 0) return 'expired'
  const hours = Math.round(ms / HOUR)
  if (hours < 1) return 'for under an hour'
  if (hours < 24) return `for ${hours} more hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `for ${days} more day${days === 1 ? '' : 's'}`
}
