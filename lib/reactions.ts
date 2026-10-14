export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

/** Shape: { "❤️": ["userId", ...] }. Coerces arbitrary Json into that shape. */
export type Reactions = Record<string, string[]>

export function normalizeReactions(raw: unknown): Reactions {
  const out: Reactions = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      const ids = v.filter((x): x is string => typeof x === 'string')
      if (ids.length > 0) out[k] = ids
    }
  }
  return out
}
