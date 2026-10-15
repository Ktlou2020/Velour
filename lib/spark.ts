/**
 * Daily Spark — one light, inclusive question per day (SAST), answered by
 * members and shared with the people they could meet.
 *
 * Pure module (no DB access) so it can be used from server routes and
 * client components alike. Database helpers live in app/api/spark/data.ts.
 *
 * Storage: SparkAnswer.questionId holds `<questionId>@<YYYY-MM-DD>` (the
 * SAST date it was asked). That keeps one answer per member per day even
 * when the rotation comes back round to the same question, and lets streaks
 * be computed from the keys alone.
 */
import { startOfDaySAST } from '@/lib/plans'

export interface SparkQuestion {
  /** Stable id, e.g. "q001". Never renumber: stored answers reference it. */
  id: string
  text: string
  /** Quick-pick choices (2–4). Omitted = open text answer. */
  options?: string[]
  /** Placeholder for open-text answers. */
  placeholder?: string
}

export const SPARK_TEXT_MAX = 140

/* Phrased so singles and couples can both answer ("you" / "you two"). */
export const SPARK_QUESTIONS: SparkQuestion[] = [
  { id: 'q001', text: 'Braai master or happy to bring the salads?', options: ['On the tongs 🔥', 'Salads & sides 🥗', 'Here for the company'] },
  { id: 'q002', text: 'Joburg energy or Cape Town calm?', options: ['Joburg ⚡', 'Cape Town 🌊', 'Durban, obviously ☀️', 'Somewhere in between'] },
  { id: 'q003', text: 'The perfect first date is…', placeholder: 'Sundowners somewhere with a view…' },
  { id: 'q004', text: 'Bunny chow: quarter, half, or “I’m sharing”?', options: ['Quarter', 'Half 💪', 'Sharing is caring'] },
  { id: 'q005', text: 'Sunrise hike or Sunday lie-in?', options: ['Sunrise hike 🌄', 'Lie-in, always 😴'] },
  { id: 'q006', text: 'What’s a small thing that instantly makes your day?', placeholder: 'A voice note from a friend…' },
  { id: 'q007', text: 'Load-shedding plan: candles & board games or out to a spot with a generator?', options: ['Candles & games 🕯️', 'Find the generator 🍸', 'Early night'] },
  { id: 'q008', text: 'A green flag you notice straight away?', placeholder: 'They’re kind to waiters…' },
  { id: 'q009', text: 'Wine farm or craft brewery?', options: ['Wine farm 🍷', 'Brewery 🍺', 'Gin bar, thanks 🍸', 'Coffee roastery ☕'] },
  { id: 'q010', text: 'Your go-to karaoke song?', placeholder: 'Something you’d belt out…' },
  { id: 'q011', text: 'Texting style?', options: ['Instant replies ⚡', 'Thoughtful paragraphs', 'Voice notes 🎙️', 'Memes only'] },
  { id: 'q012', text: 'Best road trip in South Africa?', placeholder: 'Garden Route, Wild Coast, the Karoo…' },
  { id: 'q013', text: 'Plans or spontaneity?', options: ['Planner 📅', 'Spontaneous 🎲', 'Plan to be spontaneous'] },
  { id: 'q014', text: 'Something you’re quietly proud of?', placeholder: 'Big or small…' },
  { id: 'q015', text: 'Durban curry heat level?', options: ['Mild, please', 'Medium 🌶️', 'Bring the tears 🔥🔥'] },
  { id: 'q016', text: 'Dinner party host or favourite guest?', options: ['Host 🍽️', 'Guest 🥂'] },
  { id: 'q017', text: 'The most underrated place you’ve visited?', placeholder: 'Somewhere people sleep on…' },
  { id: 'q018', text: 'Morning person or night owl?', options: ['Morning ☀️', 'Night owl 🌙', 'Afternoon, honestly'] },
  { id: 'q019', text: 'What does a perfect lazy Sunday look like?', placeholder: 'Coffee, papers, a long lunch…' },
  { id: 'q020', text: 'Beach holiday or bush getaway?', options: ['Beach 🏖️', 'Bush 🦁', 'City break 🏙️', 'Mountains 🏔️'] },
  { id: 'q021', text: 'A song that always gets you dancing?', placeholder: 'Amapiano, 80s, anything goes…' },
  { id: 'q022', text: 'Slap chips or proper fries?', options: ['Slap chips, vinegar 🍟', 'Crispy fries', 'Sweet potato fries'] },
  { id: 'q023', text: 'What’s on your bucket list this year?', placeholder: 'One thing you’d love to do…' },
  { id: 'q024', text: 'Love language you speak most?', options: ['Words 💬', 'Quality time ⏳', 'Touch 🤍', 'Acts & gifts 🎁'] },
  { id: 'q025', text: 'The best meal you’ve had recently?', placeholder: 'Where and what…' },
  { id: 'q026', text: 'Concert or comedy show?', options: ['Concert 🎶', 'Comedy 😂', 'Theatre 🎭'] },
  { id: 'q027', text: 'A skill you’d love someone to teach you?', placeholder: 'Salsa, sourdough, surfing…' },
  { id: 'q028', text: 'Rooibos, coffee or something stronger?', options: ['Rooibos 🍵', 'Coffee ☕', 'Something stronger 🥃'] },
  { id: 'q029', text: 'What makes you feel most like yourself?', placeholder: 'Being near the ocean…' },
  { id: 'q030', text: 'Ideal number of nights out per week?', options: ['Zero, I love home', 'One good one', 'Two or three 🍸', 'Ask me on the day'] },
  { id: 'q031', text: 'Your hidden talent?', placeholder: 'Something people wouldn’t guess…' },
  { id: 'q032', text: 'Pineapple on pizza?', options: ['Yes, proudly 🍍', 'Absolutely not', 'Only with chilli'] },
  { id: 'q033', text: 'Describe your vibe in three emojis.', placeholder: '🌊🍷📚' },
  { id: 'q034', text: 'Best spot for sundowners?', placeholder: 'A rooftop, a beach, a stoep…' },
  { id: 'q035', text: 'Dancing: first on the floor or need a little encouragement?', options: ['First on the floor 💃', 'Give me two songs', 'Happy watching'] },
  { id: 'q036', text: 'A book, show or podcast you keep recommending?', placeholder: 'You have to watch…' },
  { id: 'q037', text: 'Chakalaka: essential or optional?', options: ['Essential 🔥', 'Nice to have', 'Not for me'] },
  { id: 'q038', text: 'What’s something you’ve changed your mind about?', placeholder: 'I used to think…' },
  { id: 'q039', text: 'Window seat or aisle?', options: ['Window ✈️', 'Aisle', 'Whatever’s cheapest'] },
  { id: 'q040', text: 'The quality you value most in people?', options: ['Kindness 🤍', 'Humour 😄', 'Honesty', 'Curiosity 🔭'] },
  { id: 'q041', text: 'What would your friends say you’re best at?', placeholder: 'Planning trips, giving advice…' },
  { id: 'q042', text: 'Spontaneous weekend away: where are you going?', placeholder: 'Pack a bag, we’re off to…' },
  { id: 'q043', text: 'Sweet tooth or savoury?', options: ['Sweet 🍰', 'Savoury 🧀', 'Both, at once'] },
  { id: 'q044', text: 'An everyday luxury you won’t give up?', placeholder: 'Good coffee, fresh flowers…' },
  { id: 'q045', text: 'Rugby, cricket, soccer — or none of the above?', options: ['Rugby 🏉', 'Cricket 🏏', 'Soccer ⚽', 'None, thanks'] },
  { id: 'q046', text: 'What’s your idea of romance?', placeholder: 'A handwritten note, a surprise picnic…' },
  { id: 'q047', text: 'Ideal date night?', options: ['Cosy dinner 🕯️', 'Live music 🎷', 'Adventure 🧗', 'Night in 🍿'] },
  { id: 'q048', text: 'A place that feels like home to you?', placeholder: 'A city, a kitchen, a person…' },
  { id: 'q049', text: 'Cook together or order in?', options: ['Cook together 🍳', 'Order in 🛵', 'One cooks, one DJs'] },
  { id: 'q050', text: 'What’s the best compliment you’ve ever received?', placeholder: 'It stuck with me because…' },
  { id: 'q051', text: 'Camping: love it or glamping only?', options: ['Tent & stars ⛺', 'Glamping only ✨', 'Hotel, please'] },
  { id: 'q052', text: 'The first thing you notice in a person?', options: ['Smile 😊', 'Eyes 👀', 'Energy ✨', 'Style 👗'] },
  { id: 'q053', text: 'A tradition you love?', placeholder: 'Family, friends or your own…' },
  { id: 'q054', text: 'Market Saturday: what are you leaving with?', placeholder: 'Neighbourgoods? Bryanston? Tell us…' },
  { id: 'q055', text: 'Sea swim temperature tolerance?', options: ['Atlantic, bring it 🥶', 'Indian Ocean only 🌴', 'Pool, thanks'] },
  { id: 'q056', text: 'What are you looking forward to this week?', placeholder: 'Something small counts…' },
  { id: 'q057', text: 'Board games: competitive or just for fun?', options: ['Ruthless 🏆', 'Just for fun 🎲', 'I make up the rules'] },
  { id: 'q058', text: 'If you could live anywhere for a year?', placeholder: 'Lisbon, Zanzibar, the Drakensberg…' },
  { id: 'q059', text: 'Long phone calls or short and sweet?', options: ['Hours, happily 📞', 'Short & sweet', 'Text me instead'] },
  { id: 'q060', text: 'What’s a dealbreaker you’re not ashamed of?', placeholder: 'Keep it light…' },
  { id: 'q061', text: 'Biltong or droëwors?', options: ['Biltong 🥩', 'Droëwors', 'Both, obviously', 'Vegetarian 🌱'] },
  { id: 'q062', text: 'Your comfort movie?', placeholder: 'The one you’ve seen 20 times…' },
  { id: 'q063', text: 'Pick a superpower for dating.', options: ['Read minds 🧠', 'Perfect timing ⏱️', 'Teleport to dates 🌀', 'Never awkward 😎'] },
  { id: 'q064', text: 'What do you do to unwind after a long day?', placeholder: 'Bath, run, a good playlist…' },
  { id: 'q065', text: 'Festival life or intimate gigs?', options: ['Festival 🎪', 'Intimate gigs 🎸', 'House parties 🏠'] },
  { id: 'q066', text: 'One thing on your “one day” list?', placeholder: 'Learn to sail, see the Northern Lights…' },
  { id: 'q067', text: 'Heading to the coast: drive or fly?', options: ['Road trip 🚗', 'Fly ✈️', 'Train, for the romance 🚆'] },
  { id: 'q068', text: 'Best piece of advice you’ve been given?', placeholder: 'Someone once told me…' },
  { id: 'q069', text: 'Dress code for the perfect evening?', options: ['Smart & sharp 👔', 'Effortlessly casual', 'Something daring ✨'] },
  { id: 'q070', text: 'A local spot everyone should try?', placeholder: 'Coffee shop, restaurant, view…' },
  { id: 'q071', text: 'Pets: yes, please or not right now?', options: ['Dog person 🐕', 'Cat person 🐈', 'All the animals', 'Not right now'] },
  { id: 'q072', text: 'What’s something you could talk about for hours?', placeholder: 'Ask me about…' },
  { id: 'q073', text: 'Celebrating a win: big night out or quiet treat?', options: ['Big night out 🎉', 'Quiet treat 🍫', 'Tell everyone, then nap'] },
  { id: 'q074', text: 'Pick a dream dinner guest (alive or not).', placeholder: 'And what would you ask them?' },
  { id: 'q075', text: 'Gatsby or a good boerie roll?', options: ['Gatsby 🥖', 'Boerie roll 🌭', 'Why not both'] },
  { id: 'q076', text: 'What does a great friendship look like to you?', placeholder: 'Showing up, honesty, inside jokes…' },
  { id: 'q077', text: 'Rainy day plans?', options: ['Movie marathon 🎬', 'Cook something slow 🍲', 'Dance in it 🌧️', 'Nap'] },
  { id: 'q078', text: 'A trip that changed you?', placeholder: 'Where, and what you learnt…' },
  { id: 'q079', text: 'How do you take your compliments?', options: ['Graciously 🙏', 'Deflect immediately', 'Ask for more 😄'] },
  { id: 'q080', text: 'Your signature dish?', placeholder: 'What you’d cook to impress…' },
  { id: 'q081', text: 'Exploring a new city: guided or wander?', options: ['Wander & get lost 🗺️', 'Every site, planned', 'Find the best food first'] },
  { id: 'q082', text: 'What’s a small act of kindness you’ll never forget?', placeholder: 'A stranger once…' },
  { id: 'q083', text: 'Ideal getaway length?', options: ['A long weekend', 'One week', 'Two weeks+ ✈️'] },
  { id: 'q084', text: 'Three words your best friend would use to describe you?', placeholder: 'Loyal, chaotic, warm…' },
  { id: 'q085', text: 'Kruger or Kirstenbosch?', options: ['Kruger 🐘', 'Kirstenbosch 🌿', 'The Drakensberg ⛰️'] },
  { id: 'q086', text: 'What does “a good evening” mean to you?', placeholder: 'Good food, good people…' },
  { id: 'q087', text: 'Playlist on shuffle or curated?', options: ['Shuffle 🔀', 'Curated to perfection 🎧', 'Same album on repeat'] },
  { id: 'q088', text: 'A hobby you picked up recently?', placeholder: 'Padel, pottery, plants…' },
  { id: 'q089', text: 'How do you feel about surprises?', options: ['Love them 🎁', 'Small ones only', 'Please warn me'] },
  { id: 'q090', text: 'Describe your dream Saturday in one line.', placeholder: 'Market, swim, long lunch, dancing…' },
  { id: 'q091', text: 'Fancy restaurant or a hidden gem?', options: ['Fine dining 🥂', 'Hidden gem 💎', 'Street food 🌮'] },
  { id: 'q092', text: 'Something that always makes you laugh?', placeholder: 'A show, a memory, a meme…' },
  { id: 'q093', text: 'Weekend breakfast?', options: ['Full English 🍳', 'Avo toast 🥑', 'Coffee is breakfast', 'Vetkoek ❤️'] },
  { id: 'q094', text: 'Where do you feel most relaxed?', placeholder: 'By the sea, in the garden…' },
  { id: 'q095', text: 'First message: who goes first?', options: ['Me, always 💌', 'I wait to be asked', 'Whoever’s braver'] },
  { id: 'q096', text: 'What’s something new you’d like to try with the right person (or people)?', placeholder: 'Keep it PG — a cooking class? 😉' },
]

const DAY_MS = 24 * 60 * 60 * 1000
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000
/** Rotation epoch: 1 Jan 2026, SAST. */
const EPOCH = Date.UTC(2026, 0, 1) - SAST_OFFSET_MS

const BY_ID = new Map(SPARK_QUESTIONS.map((q) => [q.id, q]))

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

/** A step coprime with the list length visits every question once per cycle, mixing types. */
const STEP = (() => {
  const n = SPARK_QUESTIONS.length
  for (const s of [37, 41, 43, 47, 53, 59, 61, 1]) if (gcd(s, n) === 1) return s
  return 1
})()

/** "YYYY-MM-DD" for the SAST calendar day containing `now`. */
export function sastDateKey(now = new Date()): string {
  return new Date(startOfDaySAST(now).getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10)
}

function dayIndexOf(dateKey: string): number {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`) - SAST_OFFSET_MS
  return Math.round((start - EPOCH) / DAY_MS)
}

/** The question asked on a SAST date ("YYYY-MM-DD"). Deterministic. */
export function questionForDate(dateKey: string): SparkQuestion {
  const n = SPARK_QUESTIONS.length
  const idx = (((dayIndexOf(dateKey) * STEP) % n) + n) % n
  return SPARK_QUESTIONS[idx]
}

export function getSparkQuestion(id: string): SparkQuestion | undefined {
  return BY_ID.get(id)
}

export interface TodaySpark {
  question: SparkQuestion
  dateKey: string
  /** The value stored in SparkAnswer.questionId. */
  key: string
  /** When today's question closes (next SAST midnight), ISO. */
  closesAt: string
}

export function todaySpark(now = new Date()): TodaySpark {
  const dateKey = sastDateKey(now)
  const question = questionForDate(dateKey)
  return {
    question,
    dateKey,
    key: sparkKey(question.id, dateKey),
    closesAt: new Date(startOfDaySAST(now).getTime() + DAY_MS).toISOString(),
  }
}

export function sparkKey(questionId: string, dateKey: string): string {
  return `${questionId}@${dateKey}`
}

/** Split a stored key back into question + date (legacy bare ids have no date). */
export function parseSparkKey(key: string): { question?: SparkQuestion; dateKey?: string } {
  const [id, dateKey] = key.split('@')
  return { question: BY_ID.get(id), dateKey: dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : undefined }
}

/**
 * Validate an answer for a question. Text answers: control characters and
 * HTML-ish brackets removed, whitespace collapsed, ≤ 140 chars, no links.
 * Quick-picks must exactly match one of the options.
 */
export function validateSparkAnswer(q: SparkQuestion, raw: unknown): { answer: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'Answer must be text' }
  if (q.options) {
    const pick = q.options.find((o) => o === raw.trim())
    return pick ? { answer: pick } : { error: 'Pick one of the options' }
  }
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return { error: 'Write a short answer first' }
  if (cleaned.length > SPARK_TEXT_MAX) return { error: `Keep it under ${SPARK_TEXT_MAX} characters` }
  if (/(https?:\/\/|www\.)\S+/i.test(cleaned)) return { error: 'Links aren’t allowed in Spark answers' }
  return { answer: cleaned }
}

function prevDateKey(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10)
}

/**
 * Streaks from the set of SAST dates a member answered on.
 * `current` counts back from today — or from yesterday if today isn't answered
 * yet, so a streak stays alive until midnight. `best` is the longest run ever.
 */
export function sparkStreaks(dateKeys: Iterable<string>, now = new Date()): { current: number; best: number; answeredToday: boolean } {
  const days = new Set(dateKeys)
  const today = sastDateKey(now)
  const answeredToday = days.has(today)
  let current = 0
  let d = answeredToday ? today : prevDateKey(today)
  while (days.has(d)) { current++; d = prevDateKey(d) }

  let best = 0
  for (const day of days) {
    if (days.has(prevDateKey(day))) continue // not the start of a run
    let len = 0
    let k = day
    while (days.has(k)) {
      len++
      k = new Date(Date.parse(`${k}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10)
    }
    best = Math.max(best, len)
  }
  return { current, best: Math.max(best, current), answeredToday }
}

