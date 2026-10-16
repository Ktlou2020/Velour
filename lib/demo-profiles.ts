/**
 * Seed data for 30 demo profiles (User.isDemo = true). Created and removed from
 * Admin → Admin team (super admins only). Demo profiles never like, wink or
 * message anyone, and are excluded from founding spots, analytics, lifecycle
 * emails and public member counts. Remove them before taking payments.
 */

type City = { city: string; lat: number; lng: number }

const C: Record<string, City> = {
  jhb: { city: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  sandton: { city: 'Sandton', lat: -26.1076, lng: 28.0567 },
  pta: { city: 'Pretoria', lat: -25.7479, lng: 28.2293 },
  cpt: { city: 'Cape Town', lat: -33.9249, lng: 18.4241 },
  stellies: { city: 'Stellenbosch', lat: -33.9321, lng: 18.8602 },
  dbn: { city: 'Durban', lat: -29.8587, lng: 31.0218 },
  umhlanga: { city: 'Umhlanga', lat: -29.7246, lng: 31.0841 },
  pe: { city: 'Gqeberha', lat: -33.9608, lng: 25.6022 },
  bfn: { city: 'Bloemfontein', lat: -29.0852, lng: 26.1596 },
  el: { city: 'East London', lat: -33.0153, lng: 27.9116 },
  plk: { city: 'Polokwane', lat: -23.9045, lng: 29.4689 },
  mbombela: { city: 'Mbombela', lat: -25.4753, lng: 30.9694 },
  pmb: { city: 'Pietermaritzburg', lat: -29.6006, lng: 30.3794 },
}

export interface DemoPartner {
  name: string
  gender: 'WOMAN' | 'MAN' | 'NON_BINARY'
  dateOfBirth: string
  orientation?: string
  heightCm?: number
  bodyType?: string
}

export interface DemoProfile {
  username: string
  displayName: string
  gender: 'WOMAN' | 'MAN' | 'NON_BINARY' | null
  pronouns?: string
  dateOfBirth: string
  orientation: string
  where: keyof typeof C
  bio: string
  interestedIn: string[]
  intentions: string[]
  heightCm?: number
  bodyType?: string
  languages: string[]
  drinking?: string
  smoking?: string
  hasChildren?: string
  prompts: { question: string; answer: string }[]
  statusText?: string
  statusEmoji?: string
  /** Days since they "joined" and since last active (relative to seeding). */
  joinedDaysAgo: number
  lastSeenHoursAgo: number
  couple?: { type: 'MF' | 'FF' | 'MM' | 'MX'; members: [DemoPartner, DemoPartner] }
}

export const DEMO_CITIES = C

export const DEMO_PROFILES: DemoProfile[] = [
  // ── Women ─────────────────────────────────────────────────────────────
  {
    username: 'thandi_m', displayName: 'Thandi', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1994-03-12',
    orientation: 'STRAIGHT', where: 'jhb', heightCm: 168, bodyType: 'CURVY', languages: ['English', 'isiZulu', 'Sesotho'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Marketing by day, amateur chef by night. I take my Sunday lunches seriously and my small talk less so. Looking for someone who can hold a proper conversation over a good bottle of red.',
    interestedIn: ['MAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'My perfect weekend is…', answer: 'Neighbourgoods market on Saturday, a long braai with friends, then Sunday in bed with a series and takeaways.' },
      { question: 'A green flag I look for…', answer: 'You ask follow-up questions. Curiosity is very attractive.' },
    ],
    joinedDaysAgo: 21, lastSeenHoursAgo: 3,
  },
  {
    username: 'annika.cpt', displayName: 'Annika', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1991-08-27',
    orientation: 'BISEXUAL', where: 'cpt', heightCm: 172, bodyType: 'ATHLETIC', languages: ['English', 'Afrikaans'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Lion’s Head at sunrise, wine farms at sunset. Architect, plant hoarder, terrible at parallel parking. Open-minded and honest — I’d rather know what you want than guess.',
    interestedIn: ['MAN', 'WOMAN', 'COUPLE'], intentions: ['DATING', 'CASUAL', 'EVENTS'],
    prompts: [
      { question: 'The way to win me over is…', answer: 'Good coffee and an even better playlist for the drive to Franschhoek.' },
      { question: "I'm overly competitive about…", answer: 'Board games. I will read the rules out loud. Twice.' },
    ],
    statusText: 'Free for drinks this week', statusEmoji: '🍷',
    joinedDaysAgo: 18, lastSeenHoursAgo: 1,
  },
  {
    username: 'naledi_k', displayName: 'Naledi', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1997-11-04',
    orientation: 'STRAIGHT', where: 'pta', heightCm: 160, bodyType: 'SLIM', languages: ['English', 'Setswana', 'Sepedi'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Law grad, jacaranda season enthusiast and the friend who always books the restaurant. Soft heart, sharp tongue. Let’s skip the games.',
    interestedIn: ['MAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'My most controversial opinion…', answer: 'Pap is better the next day, fried in butter.' },
      { question: "I'm looking for someone who…", answer: 'knows where they’re going and still makes time to slow down.' },
    ],
    joinedDaysAgo: 12, lastSeenHoursAgo: 6,
  },
  {
    username: 'zanele.dbn', displayName: 'Zanele', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1989-05-19',
    orientation: 'STRAIGHT', where: 'dbn', heightCm: 165, bodyType: 'FULL_FIGURED', languages: ['English', 'isiZulu'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NOT_AT_HOME',
    bio: 'Durban born, bunny chow loyalist. Nurse, so I’ve heard every excuse in the book. Warm, loud laugh, loves the ocean. Here to meet grown-ups who know how to treat a woman.',
    interestedIn: ['MAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'Typical Sunday…', answer: 'Church in the morning, beachfront walk in the afternoon, family lunch that lasts till 6.' },
      { question: 'The way to win me over is…', answer: 'Show up when you say you will. That’s it, that’s the secret.' },
    ],
    joinedDaysAgo: 25, lastSeenHoursAgo: 20,
  },
  {
    username: 'mia_stellies', displayName: 'Mia', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1999-02-14',
    orientation: 'PANSEXUAL', where: 'stellies', heightCm: 164, bodyType: 'SLIM', languages: ['English', 'Afrikaans', 'German'],
    drinking: 'SOCIALLY', smoking: 'SOCIALLY', hasChildren: 'NONE',
    bio: 'Masters student in oenology (yes, wine school is real). Into vintage markets, film cameras and people who aren’t afraid to be a little weird.',
    interestedIn: ['MAN', 'WOMAN', 'NON_BINARY'], intentions: ['DATING', 'FRIENDSHIP', 'CASUAL'],
    prompts: [
      { question: 'I geek out on…', answer: 'Terroir. Ask me why the same grape tastes different two farms apart. Actually, maybe don’t.' },
      { question: 'Two truths and a lie…', answer: 'I’ve skydived in Mossel Bay, I speak fluent German, I’ve never eaten a koeksister.' },
    ],
    joinedDaysAgo: 9, lastSeenHoursAgo: 2,
  },
  {
    username: 'lerato.s', displayName: 'Lerato', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1993-07-30',
    orientation: 'STRAIGHT', where: 'sandton', heightCm: 170, bodyType: 'ATHLETIC', languages: ['English', 'Sesotho', 'isiZulu'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Finance, F45 and far too many airport lounges. I work hard and I’d like to play a little harder. Discreet, confident, knows what she likes.',
    interestedIn: ['MAN'], intentions: ['DATING', 'CASUAL'],
    prompts: [
      { question: 'My perfect weekend is…', answer: 'Spa on Saturday, rooftop sundowners, a late dinner I didn’t have to plan.' },
      { question: 'A green flag I look for…', answer: 'Emotional intelligence and a good watch, in that order.' },
    ],
    statusText: 'Back from Lisbon', statusEmoji: '✈️',
    joinedDaysAgo: 15, lastSeenHoursAgo: 9,
  },
  {
    username: 'carla_pe', displayName: 'Carla', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1986-10-09',
    orientation: 'STRAIGHT', where: 'pe', heightCm: 166, bodyType: 'AVERAGE', languages: ['English', 'Afrikaans'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'AT_HOME',
    bio: 'Mom of one teenager who thinks I’m embarrassing (correct). Teacher, swimmer, sunset-chaser on Pollock Beach. Ready for something fun and real with someone kind.',
    interestedIn: ['MAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: "I'm looking for someone who…", answer: 'is patient, a little funny, and doesn’t mind that my Saturdays sometimes include a school gala.' },
      { question: 'Typical Sunday…', answer: 'Early swim, coffee at the pier, marking homework I promised myself I’d do on Friday.' },
    ],
    joinedDaysAgo: 30, lastSeenHoursAgo: 30,
  },
  {
    username: 'amahle_x', displayName: 'Amahle', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1998-04-22',
    orientation: 'LESBIAN', where: 'jhb', heightCm: 162, bodyType: 'SLIM', languages: ['English', 'isiXhosa'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Graphic designer, Maboneng regular, collector of good earrings. Looking for a woman who likes slow mornings and spontaneous road trips.',
    interestedIn: ['WOMAN'], intentions: ['DATING', 'RELATIONSHIP', 'EVENTS'],
    prompts: [
      { question: 'The way to win me over is…', answer: 'Send me a song that made you think of me. Bonus points if it’s Amapiano.' },
      { question: "Let's debate…", answer: 'Is a hotdog a sandwich? (It is not.)' },
    ],
    joinedDaysAgo: 7, lastSeenHoursAgo: 4,
  },
  {
    username: 'riana.bfn', displayName: 'Riana', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1990-01-17',
    orientation: 'STRAIGHT', where: 'bfn', heightCm: 175, bodyType: 'CURVY', languages: ['Afrikaans', 'English'],
    drinking: 'REGULARLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Vet in the Free State, so expect dog hair and terrible jokes. Love a rugby Saturday, a good koffie, and a man who can braai without supervision.',
    interestedIn: ['MAN'], intentions: ['DATING', 'CASUAL'],
    prompts: [
      { question: "I'm overly competitive about…", answer: 'Rugby predictions. Cheetahs forever.' },
      { question: 'My perfect weekend is…', answer: 'A drive out to Clarens, a craft beer and absolutely no phone signal.' },
    ],
    joinedDaysAgo: 22, lastSeenHoursAgo: 14,
  },
  {
    username: 'keabetswe', displayName: 'Kea', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1995-09-03',
    orientation: 'BISEXUAL', where: 'pta', heightCm: 158, bodyType: 'CURVY', languages: ['English', 'Setswana'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Software developer who still writes notes by hand. Bookish, a bit shy at first, very much not shy after the second glass. Curious about couples — gently.',
    interestedIn: ['MAN', 'WOMAN', 'COUPLE'], intentions: ['DATING', 'COUPLES_PLAY', 'FRIENDSHIP'],
    prompts: [
      { question: 'I geek out on…', answer: 'Fantasy novels and mechanical keyboards. I contain multitudes.' },
      { question: 'A green flag I look for…', answer: 'You check in instead of assuming.' },
    ],
    joinedDaysAgo: 5, lastSeenHoursAgo: 1,
  },
  {
    username: 'priya.umh', displayName: 'Priya', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1992-12-08',
    orientation: 'STRAIGHT', where: 'umhlanga', heightCm: 163, bodyType: 'SLIM', languages: ['English', 'Hindi'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Pharmacist with a soft spot for spicy food and ocean views. I like men who are confident but not loud, and dates that don’t end at 9pm.',
    interestedIn: ['MAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'Typical Sunday…', answer: 'Lighthouse walk, breakfast at the promenade, a nap I will deny ever took place.' },
      { question: 'The way to win me over is…', answer: 'Take me for the best curry in Durban and let me order for you.' },
    ],
    joinedDaysAgo: 16, lastSeenHoursAgo: 11,
  },
  {
    username: 'nomsa.el', displayName: 'Nomsa', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1988-06-25',
    orientation: 'STRAIGHT', where: 'el', heightCm: 167, bodyType: 'AVERAGE', languages: ['English', 'isiXhosa'],
    drinking: 'NEVER', smoking: 'NEVER', hasChildren: 'NOT_AT_HOME',
    bio: 'HR manager, gospel choir alto, Nahoon beach walker. Grounded and warm. I’m done with pen pals — let’s meet for coffee.',
    interestedIn: ['MAN'], intentions: ['RELATIONSHIP', 'DATING'],
    prompts: [
      { question: "I'm looking for someone who…", answer: 'is settled in himself and still excited about life.' },
      { question: 'My most controversial opinion…', answer: 'Voice notes over three minutes should be illegal.' },
    ],
    joinedDaysAgo: 27, lastSeenHoursAgo: 40,
  },

  // ── Men ───────────────────────────────────────────────────────────────
  {
    username: 'sipho.jhb', displayName: 'Sipho', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1990-02-11',
    orientation: 'STRAIGHT', where: 'jhb', heightCm: 183, bodyType: 'ATHLETIC', languages: ['English', 'isiZulu'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Civil engineer, Sunday league striker, makes a mean oxtail. Respectful, direct and a good listener. Let’s do dinner and see where the night goes.',
    interestedIn: ['WOMAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'My perfect weekend is…', answer: 'Morning game at the club, afternoon at a jazz spot in Melville, home-cooked dinner for two.' },
      { question: 'A green flag I look for…', answer: 'You laugh at yourself.' },
    ],
    joinedDaysAgo: 20, lastSeenHoursAgo: 5,
  },
  {
    username: 'jacques_cpt', displayName: 'Jacques', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1987-09-14',
    orientation: 'STRAIGHT', where: 'cpt', heightCm: 186, bodyType: 'ATHLETIC', languages: ['Afrikaans', 'English', 'French'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Sail instructor turned startup guy. Happiest on the water or around a big table with friends. Open to new experiences, always honest about what I’m looking for.',
    interestedIn: ['WOMAN', 'COUPLE'], intentions: ['DATING', 'CASUAL', 'EVENTS'],
    prompts: [
      { question: 'Two truths and a lie…', answer: 'I’ve sailed to St Helena, I speak French, I’m scared of seagulls.' },
      { question: 'The way to win me over is…', answer: 'Say yes to a last-minute sunset sail.' },
    ],
    joinedDaysAgo: 14, lastSeenHoursAgo: 2,
  },
  {
    username: 'kabelo_m', displayName: 'Kabelo', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1995-05-02',
    orientation: 'STRAIGHT', where: 'pta', heightCm: 178, bodyType: 'AVERAGE', languages: ['English', 'Sepedi', 'Setswana'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Doctor in training, so my sleep schedule is a crime scene. Coffee snob, gym regular, recovering people-pleaser. I’ll always make time for someone worth it.',
    interestedIn: ['WOMAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: "I'm overly competitive about…", answer: 'FIFA. I will not be taking questions.' },
      { question: 'Typical Sunday…', answer: 'Post-call sleep until noon, then Hazel Food Market with my sister.' },
    ],
    joinedDaysAgo: 10, lastSeenHoursAgo: 8,
  },
  {
    username: 'dylan.dbn', displayName: 'Dylan', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1992-08-19',
    orientation: 'BISEXUAL', where: 'dbn', heightCm: 180, bodyType: 'ATHLETIC', languages: ['English'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Surfer, physio, dog dad to a rescue called Biltong. Easy-going and open-minded. Big fan of honest conversations and late-night chips on the beachfront.',
    interestedIn: ['WOMAN', 'MAN', 'COUPLE'], intentions: ['DATING', 'CASUAL', 'COUPLES_PLAY'],
    prompts: [
      { question: 'My perfect weekend is…', answer: 'Dawn patrol at New Pier, breakfast, nap, braai. Repeat.' },
      { question: 'A green flag I look for…', answer: 'Dogs like you. Dogs know.' },
    ],
    statusText: 'Waves are pumping', statusEmoji: '🏄',
    joinedDaysAgo: 11, lastSeenHoursAgo: 3,
  },
  {
    username: 'tshepo.s', displayName: 'Tshepo', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1985-12-01',
    orientation: 'STRAIGHT', where: 'sandton', heightCm: 181, bodyType: 'MUSCULAR', languages: ['English', 'Setswana', 'Sesotho'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NOT_AT_HOME',
    bio: 'Entrepreneur, father, golfer. Discretion matters to me. I value good company, good wine and women who know their worth.',
    interestedIn: ['WOMAN'], intentions: ['DATING', 'CASUAL'],
    prompts: [
      { question: "I'm looking for someone who…", answer: 'is independent, ambitious and enjoys being spoiled now and then.' },
      { question: 'My most controversial opinion…', answer: 'Sushi is overrated. Fight me.' },
    ],
    joinedDaysAgo: 24, lastSeenHoursAgo: 16,
  },
  {
    username: 'ruan_pmb', displayName: 'Ruan', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1994-03-28',
    orientation: 'STRAIGHT', where: 'pmb', heightCm: 189, bodyType: 'ATHLETIC', languages: ['Afrikaans', 'English'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Mountain biker, Comrades finisher (twice, never again, probably again). Farm boy at heart, accountant on paper. Looking for an adventure partner.',
    interestedIn: ['WOMAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'I geek out on…', answer: 'Trail maps. I will plan the route, the snacks and the post-ride burger.' },
      { question: 'Typical Sunday…', answer: 'Cascades MTB park at 7, coffee at 10, rugby at 3.' },
    ],
    joinedDaysAgo: 19, lastSeenHoursAgo: 22,
  },
  {
    username: 'mandla.plk', displayName: 'Mandla', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1989-10-15',
    orientation: 'STRAIGHT', where: 'plk', heightCm: 176, bodyType: 'AVERAGE', languages: ['English', 'Sepedi', 'Xitsonga'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'AT_HOME',
    bio: 'Single dad, mining engineer, part-time DJ at family functions. Calm energy, big heart. I’m looking for someone real to share good food and better conversations with.',
    interestedIn: ['WOMAN'], intentions: ['RELATIONSHIP', 'DATING'],
    prompts: [
      { question: 'The way to win me over is…', answer: 'Be yourself. Bring your appetite — I cook too much.' },
      { question: "Let's debate…", answer: 'Best SA album of all time. I’ll start: Brenda Fassie, Memeza.' },
    ],
    joinedDaysAgo: 13, lastSeenHoursAgo: 28,
  },
  {
    username: 'leon_mbombela', displayName: 'Leon', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1983-07-07',
    orientation: 'STRAIGHT', where: 'mbombela', heightCm: 184, bodyType: 'EXTRA', languages: ['English', 'Afrikaans'],
    drinking: 'REGULARLY', smoking: 'QUITTING', hasChildren: 'NOT_AT_HOME',
    bio: 'Game lodge manager, so my office has elephants. Divorced, happy, and enjoying life again. Into fly-fishing, bush braais and couples who like to explore.',
    interestedIn: ['WOMAN', 'COUPLE'], intentions: ['CASUAL', 'COUPLES_PLAY', 'EVENTS'],
    prompts: [
      { question: 'Two truths and a lie…', answer: 'I’ve been charged by a rhino, I can cook a whole potjie blindfolded, I’ve never seen snow.' },
      { question: 'My perfect weekend is…', answer: 'Kruger sunrise drive, long lunch, stars you can’t see in the city.' },
    ],
    joinedDaysAgo: 29, lastSeenHoursAgo: 52,
  },

  // ── LGBTQ & non-binary ────────────────────────────────────────────────
  {
    username: 'kai.cpt', displayName: 'Kai', gender: 'NON_BINARY', pronouns: 'they/them', dateOfBirth: '1996-06-18',
    orientation: 'QUEER', where: 'cpt', heightCm: 171, bodyType: 'SLIM', languages: ['English', 'Afrikaans'],
    drinking: 'SOCIALLY', smoking: 'SOCIALLY', hasChildren: 'NONE',
    bio: 'Tattoo artist in Woodstock. Thrifted everything, strong opinions about coffee, soft about animals. Here for genuine connection and good energy only.',
    interestedIn: ['WOMAN', 'NON_BINARY', 'MAN'], intentions: ['DATING', 'FRIENDSHIP', 'EVENTS'],
    prompts: [
      { question: 'I geek out on…', answer: 'Fine-line botanical tattoos. Ask me about the one I regret (there’s one).' },
      { question: 'A green flag I look for…', answer: 'You use the right pronouns without making it a whole thing.' },
    ],
    joinedDaysAgo: 8, lastSeenHoursAgo: 2,
  },
  {
    username: 'thabo.and.co', displayName: 'Thabo', gender: 'MAN', pronouns: 'he/him', dateOfBirth: '1991-04-09',
    orientation: 'GAY', where: 'jhb', heightCm: 177, bodyType: 'MUSCULAR', languages: ['English', 'isiZulu', 'Sesotho'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Fashion buyer, gym before work, brunch after church. Confident, a bit of a romantic, allergic to drama. Let’s get a drink in Braamfontein.',
    interestedIn: ['MAN'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'The way to win me over is…', answer: 'Compliment my sneakers and mean it.' },
      { question: "I'm looking for someone who…", answer: 'knows who he is and isn’t hiding it.' },
    ],
    joinedDaysAgo: 17, lastSeenHoursAgo: 7,
  },
  {
    username: 'jess.and.lu', displayName: 'Jess', gender: 'WOMAN', pronouns: 'she/they', dateOfBirth: '1993-11-21',
    orientation: 'LESBIAN', where: 'dbn', heightCm: 165, bodyType: 'ATHLETIC', languages: ['English', 'Afrikaans'],
    drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Climbing coach, festival person, fluent in sarcasm. Looking for someone to explore the Drakensberg with — and maybe more.',
    interestedIn: ['WOMAN', 'NON_BINARY'], intentions: ['DATING', 'RELATIONSHIP'],
    prompts: [
      { question: 'My perfect weekend is…', answer: 'Climbing in the Berg, camping, stars, someone else making the coffee.' },
      { question: 'Two truths and a lie…', answer: 'I’ve climbed in Thailand, I can juggle, I hate camping.' },
    ],
    joinedDaysAgo: 6, lastSeenHoursAgo: 5,
  },

  // ── Couples ───────────────────────────────────────────────────────────
  {
    username: 'nick_and_tash', displayName: 'Nick & Tash', gender: null, dateOfBirth: '1989-03-03',
    orientation: 'STRAIGHT', where: 'sandton', languages: ['English'], drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Married 8 years, still each other’s favourite person. New to the lifestyle and taking it slowly — drinks first, chemistry always. Respect and discretion are non-negotiable.',
    interestedIn: ['WOMAN', 'COUPLE'], intentions: ['COUPLES_PLAY', 'EVENTS', 'FRIENDSHIP'],
    prompts: [
      { question: "I'm looking for someone who…", answer: 'is fun, clean, confident and great company even with our clothes on.' },
      { question: 'A green flag I look for…', answer: 'You talk to both of us, not just one.' },
    ],
    joinedDaysAgo: 23, lastSeenHoursAgo: 4,
    couple: { type: 'MF', members: [
      { name: 'Nick', gender: 'MAN', dateOfBirth: '1987-06-10', orientation: 'STRAIGHT', heightCm: 182, bodyType: 'ATHLETIC' },
      { name: 'Tash', gender: 'WOMAN', dateOfBirth: '1989-03-03', orientation: 'BISEXUAL', heightCm: 166, bodyType: 'SLIM' },
    ] },
  },
  {
    username: 'cpt.couple.sl', displayName: 'Sam & Lize', gender: null, dateOfBirth: '1992-10-30',
    orientation: 'BISEXUAL', where: 'cpt', languages: ['English', 'Afrikaans'], drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Adventurous Cape Town couple. Hikers, foodies and regulars at a good house party. We love meeting interesting people — single women and like-minded couples welcome.',
    interestedIn: ['WOMAN', 'COUPLE'], intentions: ['COUPLES_PLAY', 'EVENTS', 'CASUAL'],
    prompts: [
      { question: 'My perfect weekend is…', answer: 'Hike Chapman’s Peak, oysters in Hout Bay, dinner party that ends at 2am.' },
      { question: 'Two truths and a lie…', answer: 'We met at a wedding, we’ve done the Otter Trail, we both hate wine.' },
    ],
    statusText: 'Hosting drinks Saturday', statusEmoji: '🥂',
    joinedDaysAgo: 19, lastSeenHoursAgo: 1,
    couple: { type: 'MF', members: [
      { name: 'Sam', gender: 'MAN', dateOfBirth: '1990-01-15', orientation: 'STRAIGHT', heightCm: 185, bodyType: 'MUSCULAR' },
      { name: 'Lize', gender: 'WOMAN', dateOfBirth: '1992-10-30', orientation: 'BISEXUAL', heightCm: 169, bodyType: 'CURVY' },
    ] },
  },
  {
    username: 'dbn.duo', displayName: 'Ayanda & Kyle', gender: null, dateOfBirth: '1990-07-12',
    orientation: 'STRAIGHT', where: 'umhlanga', languages: ['English', 'isiZulu'], drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'AT_HOME',
    bio: 'Parents by day, still very much in love by night. We’re curious, sociable and looking for friends who enjoy the finer things — great food, ocean views and open conversation.',
    interestedIn: ['COUPLE'], intentions: ['COUPLES_PLAY', 'FRIENDSHIP', 'EVENTS'],
    prompts: [
      { question: 'Typical Sunday…', answer: 'Kids at granny’s, long breakfast in Umhlanga, nap, sundowners.' },
      { question: 'The way to win me over is…', answer: 'Be relaxed, be respectful and bring a good bottle.' },
    ],
    joinedDaysAgo: 26, lastSeenHoursAgo: 18,
    couple: { type: 'MF', members: [
      { name: 'Ayanda', gender: 'WOMAN', dateOfBirth: '1990-07-12', orientation: 'STRAIGHT', heightCm: 163, bodyType: 'CURVY' },
      { name: 'Kyle', gender: 'MAN', dateOfBirth: '1988-02-27', orientation: 'STRAIGHT', heightCm: 180, bodyType: 'AVERAGE' },
    ] },
  },
  {
    username: 'zoe.and.mo', displayName: 'Zoë & Mo', gender: null, dateOfBirth: '1995-05-05',
    orientation: 'LESBIAN', where: 'jhb', languages: ['English', 'Afrikaans', 'Sesotho'], drinking: 'SOCIALLY', smoking: 'SOCIALLY', hasChildren: 'NONE',
    bio: 'Two women, one apartment, too many plants. We’re looking for new friends, fun nights out and maybe a special someone to join our adventures.',
    interestedIn: ['WOMAN'], intentions: ['FRIENDSHIP', 'COUPLES_PLAY', 'EVENTS'],
    prompts: [
      { question: "Let's debate…", answer: 'Best rooftop bar in Joburg. We have a spreadsheet. Seriously.' },
      { question: 'A green flag I look for…', answer: 'Kindness to waiters. Always.' },
    ],
    joinedDaysAgo: 10, lastSeenHoursAgo: 6,
    couple: { type: 'FF', members: [
      { name: 'Zoë', gender: 'WOMAN', dateOfBirth: '1995-05-05', orientation: 'LESBIAN', heightCm: 167, bodyType: 'SLIM' },
      { name: 'Mo', gender: 'WOMAN', dateOfBirth: '1993-09-19', orientation: 'BISEXUAL', heightCm: 159, bodyType: 'CURVY' },
    ] },
  },
  {
    username: 'pta.pair', displayName: 'Ben & Refilwe', gender: null, dateOfBirth: '1986-12-12',
    orientation: 'STRAIGHT', where: 'pta', languages: ['English', 'Setswana', 'Afrikaans'], drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NOT_AT_HOME',
    bio: 'Experienced, laid-back couple in our late thirties. Empty nest, full calendar. We enjoy lifestyle events and dinners with interesting couples. No pressure, ever.',
    interestedIn: ['COUPLE', 'WOMAN'], intentions: ['COUPLES_PLAY', 'EVENTS'],
    prompts: [
      { question: "I'm looking for someone who…", answer: 'is mature, discreet and genuinely good company.' },
      { question: 'My perfect weekend is…', answer: 'A weekend away in Magaliesberg with friends, good food and no kids’ WhatsApp group.' },
    ],
    joinedDaysAgo: 28, lastSeenHoursAgo: 12,
    couple: { type: 'MF', members: [
      { name: 'Ben', gender: 'MAN', dateOfBirth: '1984-04-21', orientation: 'STRAIGHT', heightCm: 187, bodyType: 'AVERAGE' },
      { name: 'Refilwe', gender: 'WOMAN', dateOfBirth: '1986-12-12', orientation: 'BISEXUAL', heightCm: 165, bodyType: 'CURVY' },
    ] },
  },
  {
    username: 'cpt.guys', displayName: 'Luca & Andile', gender: null, dateOfBirth: '1991-08-08',
    orientation: 'GAY', where: 'cpt', languages: ['English', 'isiXhosa', 'Portuguese'], drinking: 'SOCIALLY', smoking: 'NEVER', hasChildren: 'NONE',
    bio: 'Together five years, based in Green Point. We love gallery openings, beach volleyball and long dinners. Open to meeting other guys and couples for friendship and fun.',
    interestedIn: ['MAN', 'COUPLE'], intentions: ['FRIENDSHIP', 'COUPLES_PLAY', 'EVENTS'],
    prompts: [
      { question: 'Typical Sunday…', answer: 'Clifton 4th, a very long lunch, and a sunset walk on the promenade.' },
      { question: 'Two truths and a lie…', answer: 'We met in Lisbon, we’ve run the Two Oceans, we hate the beach.' },
    ],
    joinedDaysAgo: 15, lastSeenHoursAgo: 9,
    couple: { type: 'MM', members: [
      { name: 'Luca', gender: 'MAN', dateOfBirth: '1991-08-08', orientation: 'GAY', heightCm: 179, bodyType: 'ATHLETIC' },
      { name: 'Andile', gender: 'MAN', dateOfBirth: '1993-02-02', orientation: 'GAY', heightCm: 184, bodyType: 'MUSCULAR' },
    ] },
  },
  // ── More singles ──────────────────────────────────────────────────────
  {
    username: 'bianca.jhb', displayName: 'Bianca', gender: 'WOMAN', pronouns: 'she/her', dateOfBirth: '1996-01-26',
    orientation: 'BISEXUAL', where: 'jhb', heightCm: 169, bodyType: 'ATHLETIC', languages: ['English', 'Portuguese'],
    drinking: 'SOCIALLY', smoking: 'SOCIALLY', hasChildren: 'NONE',
    bio: 'Portuguese-South African, so food is my love language. Dancer, pole fitness instructor, night owl. Confident, playful, and very clear about boundaries.',
    interestedIn: ['MAN', 'WOMAN', 'COUPLE'], intentions: ['CASUAL', 'EVENTS', 'COUPLES_PLAY'],
    prompts: [
      { question: 'The way to win me over is…', answer: 'Dance with me. Badly is fine. Enthusiastically is required.' },
      { question: 'My most controversial opinion…', answer: 'Peri-peri belongs on everything. Including breakfast.' },
    ],
    statusText: 'Out dancing Friday', statusEmoji: '💃',
    joinedDaysAgo: 4, lastSeenHoursAgo: 2,
  },
]
