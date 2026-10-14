/**
 * Chat games — short, playful prompts members can drop into a conversation.
 * Pure module (no DB): the content is shared by the composer's game picker
 * (client) and message validation / redaction (server).
 *
 * Content is tasteful, inclusive and never explicit. Prompts are referenced by
 * id so the server only ever stores text from this list (no free-form prompt
 * injection), except "Two truths and a lie" where players write their own
 * statements.
 */

export type GameKind = 'this_or_that' | 'would_you_rather' | 'two_truths' | 'questions'

export const GAME_KINDS: GameKind[] = ['this_or_that', 'would_you_rather', 'two_truths', 'questions']

export const GAME_INFO: Record<GameKind, { title: string; emoji: string; blurb: string }> = {
  this_or_that: { title: 'This or That', emoji: '⚡', blurb: 'Two options, one pick. See if your tastes match.' },
  would_you_rather: { title: 'Would you rather', emoji: '🤔', blurb: 'Tricky choices that tell you a lot.' },
  two_truths: { title: 'Two truths & a lie', emoji: '🕵️', blurb: 'Write three facts — one is fake. Can they spot it?' },
  questions: { title: '21 Questions', emoji: '💬', blurb: 'A random deep or fun question to answer together.' },
}

export interface ChoicePrompt { id: string; a: string; b: string }
export interface QuestionPrompt { id: string; q: string; tone: 'fun' | 'deep' }

const THIS_OR_THAT_RAW: [string, string][] = [
  ['Sunrise hike', 'Sunset braai'],
  ['Beach weekend', 'Bush getaway'],
  ['Coffee', 'Rooibos'],
  ['Cape Town', 'Joburg'],
  ['Night in', 'Night out'],
  ['Road trip', 'Weekend flight'],
  ['Wine farm', 'Craft brewery'],
  ['Dogs', 'Cats'],
  ['Cook together', 'Order in'],
  ['Live music', 'Comedy show'],
  ['Mountains', 'Ocean'],
  ['Early bird', 'Night owl'],
  ['Sweet', 'Savoury'],
  ['Texting', 'Voice notes'],
  ['Board games', 'Video games'],
  ['Museum date', 'Market date'],
  ['Rugby', 'Football'],
  ['Spontaneous plans', 'Planned to the minute'],
  ['Picnic', 'Fancy dinner'],
  ['Summer', 'Winter'],
  ['Books', 'Podcasts'],
  ['Amapiano', 'Old-school R&B'],
  ['Bunny chow', 'Gatsby'],
  ['Karaoke', 'Dance floor'],
  ['Camping', 'Boutique hotel'],
  ['Pap & wors', 'Sushi'],
  ['Movie at home', 'Movie at the cinema'],
  ['City lights', 'Starry skies'],
  ['Brunch', 'Late-night snacks'],
  ['Thunderstorm', 'Clear blue sky'],
  ['Long walk', 'Long drive'],
  ['Cocktail bar', 'Cosy wine bar'],
  ['Handwritten note', 'Surprise playlist'],
  ['Travel light', 'Pack everything'],
  ['Netflix binge', 'One great film'],
  ['Kruger safari', 'Garden Route drive'],
  ['Morning workout', 'Evening yoga'],
  ['Hot chocolate', 'Milkshake'],
  ['Big party', 'Small dinner with friends'],
  ['Pizza', 'Tacos'],
  ['Poetry night', 'Jazz club'],
  ['Dessert first', 'Dessert never'],
  ['Window seat', 'Aisle seat'],
  ['Slow dance', 'Silly dance'],
  ['Farmers market', 'Food festival'],
]

const WOULD_YOU_RATHER_RAW: [string, string][] = [
  ['Have a personal chef', 'Have a personal driver'],
  ['Live by the sea', 'Live in the mountains'],
  ['Travel to the past', 'Travel to the future'],
  ['Always know the perfect thing to say', 'Always know the perfect song to play'],
  ['Explore every country in Africa', 'Explore every city in Europe'],
  ['Give up social media for a year', 'Give up takeaways for a year'],
  ['Be fluent in every language', 'Play every instrument'],
  ['Have a weekend in Zanzibar', 'Have a weekend in Paris'],
  ['Only eat braai food forever', 'Never eat braai food again'],
  ['Win a cooking show', 'Win a dance competition'],
  ['Have a tiny house on the beach', 'A huge apartment in the city'],
  ['Relive your best day', 'Skip your worst day'],
  ['Be famous for your art', 'Be secretly brilliant at everything'],
  ['Go on a hot-air balloon date', 'Go on a sunset sailing date'],
  ['Read minds for a day', 'Be invisible for a day'],
  ['Never be stuck in traffic again', 'Never have load shedding again'],
  ['Always be 10 minutes early', 'Always be 10 minutes late'],
  ['Have a rewind button', 'Have a pause button'],
  ['Spend a month on safari', 'Spend a month on a cruise'],
  ['Get a handwritten letter', 'Get a surprise visit'],
  ['Only listen to one album forever', 'Only watch one film forever'],
  ['Be able to teleport', 'Be able to fly'],
  ['Have a dinner party with your heroes', 'A road trip with your best friends'],
  ['Wake up at 5am feeling great', 'Sleep in until 11 guilt-free'],
  ['Know how every story ends', 'Never get spoilers again'],
  ['Learn to surf', 'Learn to salsa'],
  ['Have endless free flights', 'Have endless free meals'],
  ['Live without music', 'Live without movies'],
  ['Talk to animals', 'Speak every human language'],
  ['Have a garden full of veggies', 'A balcony full of flowers'],
  ['Go stargazing in the Karoo', 'Go whale watching in Hermanus'],
  ['Be the funniest person in the room', 'Be the smartest person in the room'],
  ['Plan the perfect date', 'Be surprised with the perfect date'],
]

const QUESTIONS_RAW: [string, 'fun' | 'deep'][] = [
  ["What's a small thing that instantly makes your day better?", 'fun'],
  ["What's the best trip you've ever taken?", 'fun'],
  ['What song have you had on repeat lately?', 'fun'],
  ['If you could have dinner with anyone, alive or not, who would it be?', 'fun'],
  ["What's your go-to karaoke song?", 'fun'],
  ["What's the most spontaneous thing you've ever done?", 'fun'],
  ['What would your perfect Sunday look like?', 'fun'],
  ["What's a skill you'd love to learn this year?", 'fun'],
  ["What's your comfort meal?", 'fun'],
  ['Which fictional world would you move into?', 'fun'],
  ["What's the best concert or show you've been to?", 'fun'],
  ['What were you obsessed with as a kid?', 'fun'],
  ["What's a hidden gem in your city everyone should know about?", 'fun'],
  ["What's your most useless talent?", 'fun'],
  ['Beach, bush or city for a long weekend — and where exactly?', 'fun'],
  ["What's a film you can watch over and over?", 'fun'],
  ["What's the last thing that made you laugh out loud?", 'fun'],
  ['What would your walk-up song be?', 'fun'],
  ["If you opened a restaurant, what would be on the menu?", 'fun'],
  ["What's the most memorable meal you've ever had?", 'fun'],
  ["What's your favourite way to spend a rainy day?", 'fun'],
  ["What's one thing on your bucket list you'll do soon?", 'fun'],
  ["What's your unpopular food opinion?", 'fun'],
  ['What app would be the hardest for you to delete?', 'fun'],
  ['If you won the Lotto tomorrow, what would you do first?', 'fun'],
  ["What's the best piece of advice you've ever been given?", 'deep'],
  ['What are you most proud of that most people don’t know about?', 'deep'],
  ['What does a really good relationship look like to you?', 'deep'],
  ['When do you feel most like yourself?', 'deep'],
  ["What's something you've changed your mind about recently?", 'deep'],
  ["What's a lesson you learned the hard way?", 'deep'],
  ['Who has had the biggest influence on who you are today?', 'deep'],
  ['What are you looking for right now — in life, not just dating?', 'deep'],
  ['What makes you feel truly cared for?', 'deep'],
  ["What's a dream you've never said out loud?", 'deep'],
  ['How do your friends describe you?', 'deep'],
  ['What does home mean to you?', 'deep'],
  ['What are you grateful for this week?', 'deep'],
  ["What's something you're working on about yourself?", 'deep'],
  ['What tradition from your family would you keep forever?', 'deep'],
  ['What do you value most in a friendship?', 'deep'],
  ['What scares you a little but excites you more?', 'deep'],
  ["What's the kindest thing a stranger has done for you?", 'deep'],
  ['What would you tell your 18-year-old self?', 'deep'],
  ['What does your ideal life look like in five years?', 'deep'],
  ['What helps you recharge when life gets busy?', 'deep'],
  ['What are your green flags in a person?', 'deep'],
  ['What is something you will never compromise on?', 'deep'],
  ["What's a moment that changed the direction of your life?", 'deep'],
  ['What does a perfect first date feel like, not just look like?', 'deep'],
  ['What is your love language — and how did you figure it out?', 'deep'],
  ['What would make you say yes to a second date?', 'deep'],
  ['What is a cause or community close to your heart?', 'deep'],
]

export const THIS_OR_THAT: ChoicePrompt[] = THIS_OR_THAT_RAW.map(([a, b], i) => ({ id: `tt${i + 1}`, a, b }))
export const WOULD_YOU_RATHER: ChoicePrompt[] = WOULD_YOU_RATHER_RAW.map(([a, b], i) => ({ id: `wyr${i + 1}`, a, b }))
export const QUESTIONS: QuestionPrompt[] = QUESTIONS_RAW.map(([q, tone], i) => ({ id: `q${i + 1}`, q, tone }))

export const MAX_STATEMENT = 140
export const MAX_ANSWER_TEXT = 300

export function isGameKind(v: unknown): v is GameKind {
  return typeof v === 'string' && (GAME_KINDS as string[]).includes(v)
}

export function findChoicePrompt(game: 'this_or_that' | 'would_you_rather', id: unknown): ChoicePrompt | null {
  if (typeof id !== 'string') return null
  const list = game === 'this_or_that' ? THIS_OR_THAT : WOULD_YOU_RATHER
  return list.find((p) => p.id === id) ?? null
}

export function findQuestion(id: unknown): QuestionPrompt | null {
  if (typeof id !== 'string') return null
  return QUESTIONS.find((p) => p.id === id) ?? null
}

/** Random item, avoiding `exclude` ids when possible. */
export function randomPrompt<T extends { id: string }>(list: T[], exclude: string[] = []): T {
  const pool = list.filter((p) => !exclude.includes(p.id))
  const from = pool.length ? pool : list
  return from[Math.floor(Math.random() * from.length)]
}

// ── Stored shape (Message.meta for kind = GAME) ─────────────────────────────

export interface GameAnswer {
  /** Option index (choice games / two truths guess) */
  choice?: number
  /** Free-text answer (21 Questions) */
  text?: string
  /** Shared couple account: which partner answered */
  as?: string | null
  at: string
  /** Set when redacted for a viewer who hasn't played yet */
  hidden?: boolean
}

export interface GameMeta {
  game: GameKind
  v: 1
  promptId?: string
  prompt: string
  options?: string[]
  /** Two truths: index of the lie (stripped for viewers who haven't guessed) */
  lie?: number
  answers: Record<string, GameAnswer>
}

export function gamePreview(game: GameKind): string {
  return `🎲 ${GAME_INFO[game].title}`
}

/** Coerce stored Json into GameMeta (or null if it isn't one). */
export function parseGameMeta(raw: unknown): GameMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const m = raw as Record<string, unknown>
  if (!isGameKind(m.game) || typeof m.prompt !== 'string') return null
  const answers: Record<string, GameAnswer> = {}
  if (m.answers && typeof m.answers === 'object' && !Array.isArray(m.answers)) {
    for (const [k, v] of Object.entries(m.answers as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue
      const a = v as Record<string, unknown>
      answers[k] = {
        ...(typeof a.choice === 'number' ? { choice: a.choice } : {}),
        ...(typeof a.text === 'string' ? { text: a.text } : {}),
        as: typeof a.as === 'string' ? a.as : null,
        at: typeof a.at === 'string' ? a.at : new Date(0).toISOString(),
      }
    }
  }
  return {
    game: m.game,
    v: 1,
    ...(typeof m.promptId === 'string' ? { promptId: m.promptId } : {}),
    prompt: m.prompt,
    ...(Array.isArray(m.options) ? { options: m.options.filter((o): o is string => typeof o === 'string') } : {}),
    ...(typeof m.lie === 'number' ? { lie: m.lie } : {}),
    answers,
  }
}

/**
 * What `viewerId` may see of a game. Until a player has answered, the other
 * answers (and, for Two truths, which statement is the lie) stay hidden so
 * nobody can peek. The sender's side (the sender and their linked partner)
 * always sees everything.
 */
export function redactGameMeta(raw: unknown, senderId: string, viewerId: string, viewerSide: string[]): GameMeta | null {
  const meta = parseGameMeta(raw)
  if (!meta) return null
  const onSenderSide = viewerId === senderId || viewerSide.includes(senderId)
  const played = !!meta.answers[viewerId]
  if (onSenderSide || played) return meta
  const answers: Record<string, GameAnswer> = {}
  for (const [k, a] of Object.entries(meta.answers)) answers[k] = { as: a.as ?? null, at: a.at, hidden: true }
  const { lie: _lie, ...rest } = meta // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, answers }
}

/** Format seconds as m:ss. */
export function fmtDuration(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function voicePreview(sec: number | null | undefined): string {
  return `🎤 Voice note (${fmtDuration(sec)})`
}

/** Apply per-viewer game redaction to a message row before it is sent to a client. */
export function messageForViewer<T extends { kind?: string | null; meta?: unknown; senderId: string }>(
  m: T,
  viewerId: string,
  viewerSide: string[],
): T {
  if (m.kind !== 'GAME') return m
  return { ...m, meta: redactGameMeta(m.meta, m.senderId, viewerId, viewerSide) }
}
