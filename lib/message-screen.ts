import { db } from '@/lib/db'
import { FLAG_ORDER, type FlagCategory } from '@/lib/message-flags'

/**
 * Automatic screening of chat messages for admin review (/admin/messages).
 * It only flags — nothing is blocked or hidden, and members aren't told.
 * Patterns are deliberately conservative: an adult platform expects flirting
 * and explicit talk between adults, so this looks for signs of real harm.
 */
export { FLAG_LABELS, FLAG_ORDER, type FlagCategory } from '@/lib/message-flags'

const RULES: { category: FlagCategory; patterns: RegExp[] }[] = [
  {
    category: 'UNDERAGE',
    patterns: [
      /\b(i'?m|i am|im)\s+(only\s+)?1[0-7]\b(?!\s*(cm|kg|km|min|minutes|hours|h)\b)/i,
      /\b1[0-7]\s*(years?|yrs?)\s*old\b/i,
      /\b(in|doing)\s+(grade|gr)\s*([6-9]|1[0-2])\b/i,
      /\b(i'?m|i am|im)\s+(still\s+)?(in\s+high\s*school|at\s+school|a\s+matric(\s+learner)?|under\s*age|underage|a\s+minor)\b/i,
    ],
  },
  {
    category: 'THREAT',
    patterns: [
      /\b(i('| wi)ll|gonna|going to)\s+(kill|hurt|stab|shoot|rape|beat|find)\s+(you|u|ur|your)\b/i,
      /\b(kill|rape)\s+(you|u)\b/i,
      /\b(kill|hang)\s+your\s*self\b|\bkys\b/i,
      /\bi\s+know\s+where\s+you\s+(live|stay|work)\b/i,
      /\b(leak|post|share|send)\s+(your|ur)\s+(pics|photos|nudes|videos)\b/i,
    ],
  },
  {
    category: 'SCAM',
    patterns: [
      /\b(send|lend|loan|transfer|give)\s+(me\s+)?(some\s+)?(money|cash|r\s?\d+|funds)\b/i,
      /\b(e-?wallet|cash\s*send|western\s+union|moneygram|gift\s*cards?|i?tunes\s+cards?)\b/i,
      /\b(bitcoin|btc|crypto|usdt|forex|binary\s+options?|investment\s+opportunity)\b/i,
      /\b(airtime|data\s+bundle)\s+(for\s+me|please|pls)\b/i,
      /\b(your|ur)\s+(bank|card)\s+(details|number|pin)\b/i,
    ],
  },
  {
    category: 'HARASSMENT',
    patterns: [
      /\b(ugly|fat|stupid|worthless|disgusting)\s+(bitch|whore|slut|cow|pig)\b/i,
      /\b(nobody|no\s*one)\s+(will\s+ever\s+)?(wants?|loves?)\s+(you|u)\b/i,
      /\b(shut\s+up\s+)?(you|u)\s+(dumb|stupid|ugly)\s+(bitch|cunt|whore)\b/i,
    ],
  },
  {
    category: 'CONTACT',
    patterns: [
      /(\+27|\b0)[\s-]?[6-8]\d([\s-]?\d){7}\b/,
      /\b(whats\s?app|watsapp|telegram|signal|snap\s?chat|insta(gram)?)\b.{0,20}(me|number|no\.?|@)/i,
    ],
  },
]

export function screenMessage(text: string): { categories: FlagCategory[]; excerpt: string } | null {
  const content = text.trim()
  if (!content) return null
  const hits: FlagCategory[] = []
  let firstIndex = -1
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = re.exec(content)
      if (m) {
        hits.push(rule.category)
        if (firstIndex === -1 || m.index < firstIndex) firstIndex = m.index
        break
      }
    }
  }
  if (hits.length === 0) return null
  const start = Math.max(0, firstIndex - 60)
  const excerpt = (start > 0 ? '…' : '') + content.slice(start, start + 200) + (start + 200 < content.length ? '…' : '')
  return { categories: FLAG_ORDER.filter((c) => hits.includes(c)), excerpt }
}

/** Screen a just-sent message and queue it for review if needed. Never throws. */
export async function screenAndFlag(m: { id: string; conversationId: string; senderId: string; content: string | null }): Promise<void> {
  try {
    const r = screenMessage(m.content ?? '')
    if (!r) return
    await db.messageFlag.create({
      data: { messageId: m.id, conversationId: m.conversationId, senderId: m.senderId, categories: r.categories, excerpt: r.excerpt },
    })
  } catch (e) {
    console.error('message screening failed:', e instanceof Error ? e.message : e)
  }
}
