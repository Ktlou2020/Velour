/** Flag categories for message screening — safe to import in client components (no database). */
export type FlagCategory = 'UNDERAGE' | 'THREAT' | 'SCAM' | 'HARASSMENT' | 'CONTACT'

/** Most serious first; the review queue sorts by this. */
export const FLAG_ORDER: FlagCategory[] = ['UNDERAGE', 'THREAT', 'SCAM', 'HARASSMENT', 'CONTACT']

export const FLAG_LABELS: Record<FlagCategory, string> = {
  UNDERAGE: 'Possible minor',
  THREAT: 'Threat or violence',
  SCAM: 'Money / scam',
  HARASSMENT: 'Harassment',
  CONTACT: 'Contact details shared',
}
