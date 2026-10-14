/** Review criteria and limits — shared by server code and client components (no imports). */

export const CRITERIA = [
  { key: 'respectful', label: 'Respectful', hint: 'Courteous, kind, respected boundaries' },
  { key: 'communication', label: 'Communication', hint: 'Clear and responsive' },
  { key: 'authenticity', label: 'Authenticity', hint: 'Looked and acted like their profile' },
  { key: 'reliability', label: 'Reliability', hint: 'Showed up and was on time' },
  { key: 'overall', label: 'Overall experience', hint: 'How it went, all things considered' },
] as const

export type CriterionKey = (typeof CRITERIA)[number]['key']
export type Ratings = Record<CriterionKey, number>

export const REQUEST_TTL_DAYS = 30
export const BLIND_DAYS = 14
export const COMMENT_MIN = 20
export const COMMENT_MAX = 500
export const RESPONSE_MAX = 500
export const REQUESTS_PER_DAY = 10
/** Chat prompt: total messages, and the minimum from each side. */
export const PROMPT_MIN_TOTAL = 20
export const PROMPT_MIN_EACH = 5

