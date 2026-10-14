export const PROFILE_PROMPT_QUESTIONS = [
  'My perfect weekend is…',
  'The way to win me over is…',
  "I'm overly competitive about…",
  'A green flag I look for…',
  'My most controversial opinion…',
  'Two truths and a lie…',
  'I geek out on…',
  "Let's debate…",
  'Typical Sunday…',
  "I'm looking for someone who…",
] as const;

export const MAX_PROMPTS = 3;
export const MAX_PROMPT_ANSWER = 200;

export interface ProfilePrompt {
  question: string;
  answer: string;
}

/** Parse a stored Json value into a safe list of prompts (never throws). */
export function parsePrompts(value: unknown): ProfilePrompt[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is ProfilePrompt =>
      !!p && typeof p === 'object' &&
      typeof (p as ProfilePrompt).question === 'string' &&
      typeof (p as ProfilePrompt).answer === 'string')
    .slice(0, MAX_PROMPTS)
    .map((p) => ({ question: p.question, answer: p.answer }));
}

/** Validate user input. Returns cleaned prompts or an error message. */
export function validatePrompts(value: unknown): { prompts: ProfilePrompt[] } | { error: string } {
  if (!Array.isArray(value)) return { error: 'Prompts must be a list' };
  if (value.length > MAX_PROMPTS) return { error: `You can answer up to ${MAX_PROMPTS} prompts` };
  const seen = new Set<string>();
  const out: ProfilePrompt[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return { error: 'Invalid prompt' };
    const { question, answer } = raw as { question?: unknown; answer?: unknown };
    if (typeof question !== 'string' || !(PROFILE_PROMPT_QUESTIONS as readonly string[]).includes(question)) {
      return { error: 'Unknown prompt question' };
    }
    if (seen.has(question)) return { error: 'Each prompt can only be used once' };
    if (typeof answer !== 'string') return { error: 'Prompt answer must be text' };
    const trimmed = answer.trim();
    if (!trimmed) return { error: 'Prompt answers cannot be empty' };
    if (trimmed.length > MAX_PROMPT_ANSWER) return { error: `Prompt answers must be ${MAX_PROMPT_ANSWER} characters or fewer` };
    seen.add(question);
    out.push({ question, answer: trimmed });
  }
  return { prompts: out };
}
