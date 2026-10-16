/**
 * Content for the public /dating/[slug] landing pages.
 *
 * Copy rules: tasteful and non-explicit, no invented stats, testimonials or
 * member counts. Local colour is limited to well-known neighbourhoods and the
 * general feel of each place — nothing we can't stand behind.
 */

export type DatingKind = 'city' | 'couples-city' | 'audience';

export interface FaqItem { q: string; a: string }
export interface Section { title: string; body: string[] }

export interface DatingPage {
  slug: string;
  kind: DatingKind;
  /** Short label for link lists, e.g. "Cape Town" or "Couples in Cape Town". */
  label: string;
  /** <title> (the root layout appends " · Unbound"). */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  sections: Section[];
  faqs: FaqItem[];
  /** Profile.city values (case-insensitive) counted for the live member figure. */
  cityMatches?: string[];
  /** Related slugs shown under "Explore more". */
  related: string[];
}

interface CityInfo {
  slug: string;
  name: string;
  /** Alternate / official name, if any. */
  alt?: string;
  province: string;
  /** Extra Profile.city spellings to count. */
  matches?: string[];
  intro: string;
  vibe: Section;
  dates: Section;
  local: FaqItem;
}

const CITIES: CityInfo[] = [
  {
    slug: 'johannesburg', name: 'Johannesburg', province: 'Gauteng', matches: ['Joburg', 'Jozi'],
    intro: 'Joburg moves fast, and so do its people. Unbound gives busy singles and couples in Jozi a private, verified place to meet people who actually want the same thing — without the noise of mainstream apps.',
    vibe: {
      title: 'Dating in Jozi',
      body: [
        'From Maboneng rooftops to Parkhurst’s 4th Avenue and the restaurants of Melville, Johannesburg rewards people who make plans. Most members here are juggling long days and longer commutes, so clear intentions and quick, respectful conversation go a long way.',
        'Unbound lets you say exactly what you’re looking for up front — a relationship, something casual, new friends, or meeting other couples — so you spend your evenings on dates, not on guessing games.',
      ],
    },
    dates: {
      title: 'First-date ideas around Johannesburg',
      body: [
        'Keep first meetings public and easy to leave: a weekend market such as Neighbourgoods in Braamfontein, a coffee in Rosebank, sundowners with a view of the city, or a gallery afternoon in Maboneng.',
        'Use Share My Date in our Safety Centre to send the where-and-when to a friend before you head out, and arrange your own transport there and back.',
      ],
    },
    local: { q: 'Does Unbound cover the whole of Gauteng?', a: 'Yes. You can search by distance, so members in Joburg can just as easily meet people in Sandton, Midrand, the East and West Rand or Pretoria. Free members search up to 250 km; Gold and Platinum can search anywhere.' },
  },
  {
    slug: 'cape-town', name: 'Cape Town', province: 'Western Cape', matches: ['Kaapstad'],
    intro: 'Mountain, ocean and a long-table culture — Cape Town is made for slow, deliberate dating. Unbound connects verified singles and couples across the Mother City with privacy built in.',
    vibe: {
      title: 'Dating in the Mother City',
      body: [
        'Capetonians tend to value lifestyle as much as chemistry: a hike up Lion’s Head, a swim at Clifton or a long lunch in the winelands. Profiles on Unbound let you lead with what you love doing, so you can find people who want the same weekends you do.',
        'The city is also famously small once you’re in a scene. Discreet features — blurred chat photos, a snooze switch and incognito browsing on Platinum — mean you decide who sees you, and when.',
      ],
    },
    dates: {
      title: 'First-date ideas around Cape Town',
      body: [
        'Sunset on Signal Hill, a coffee on Bree Street, a walk along the Sea Point promenade or a market morning at the Oranjezicht City Farm — public, relaxed and easy to turn into a second date.',
        'If you’re heading somewhere more remote, like a trail or a wine farm, wait until you’ve met a few times and always tell a friend your plans.',
      ],
    },
    local: { q: 'Can I meet people in Stellenbosch and the winelands too?', a: 'Yes. Search by distance from wherever you are, so Cape Town members regularly match with people in Stellenbosch, Paarl, Somerset West and along the coast.' },
  },
  {
    slug: 'durban', name: 'Durban', province: 'KwaZulu-Natal', matches: ['eThekwini'],
    intro: 'Warm water, warm people and a laid-back pace. Unbound helps singles and couples in Durban meet verified members who are open about what they want.',
    vibe: {
      title: 'Dating in Durban',
      body: [
        'Durban’s year-round summer makes dating an outdoor affair — the Golden Mile promenade, Florida Road’s restaurants and the Glenwood coffee scene. People here tend to be friendly and direct, and Unbound’s prompts and icebreakers help that warmth come across from the first message.',
        'With members across eThekwini, from Berea and Morningside up to Umhlanga and Ballito, distance-based search keeps your matches close enough to actually meet.',
      ],
    },
    dates: {
      title: 'First-date ideas around Durban',
      body: [
        'An early walk along the beachfront, a bunny chow lunch, coffee in Glenwood or a sundowner on Florida Road. Daytime first dates in busy areas are a great way to start.',
        'Video-call before you meet — it takes five minutes and confirms the person matches their verified photos.',
      ],
    },
    local: { q: 'Are there Unbound members north of Durban?', a: 'Unbound is open across KwaZulu-Natal. Set your search distance to include Umhlanga, Ballito or Pietermaritzburg and you’ll see members there too.' },
  },
  {
    slug: 'pretoria', name: 'Pretoria', alt: 'Tshwane', province: 'Gauteng', matches: ['Tshwane', 'Centurion'],
    intro: 'Jacaranda-lined streets, a university-town energy and a strong sense of community — Pretoria dating is about real connection. Unbound brings verified singles and couples in Tshwane together, discreetly.',
    vibe: {
      title: 'Dating in Pretoria',
      body: [
        'Between Hatfield’s student buzz, the restaurants of Brooklyn and Menlyn, and the quieter suburbs of the east, Pretoria has room for every pace. Many members here prefer to keep their dating life private from colleagues and neighbours — exactly what Unbound’s privacy controls are built for.',
        'And with Johannesburg a short drive away, you can widen your search whenever you like.',
      ],
    },
    dates: {
      title: 'First-date ideas around Pretoria',
      body: [
        'A walk through the Union Buildings gardens, a Saturday market in Hazelwood, coffee in Brooklyn or dinner in Menlyn Maine. Keep it public and daytime-friendly for a first meeting.',
        'Use Share My Date to let a friend know where you’ll be — it takes seconds.',
      ],
    },
    local: { q: 'Can I search Pretoria and Johannesburg at the same time?', a: 'Yes. Search is distance-based, so a wider radius from Pretoria naturally includes Centurion, Midrand and Johannesburg.' },
  },
  {
    slug: 'port-elizabeth', name: 'Port Elizabeth', alt: 'Gqeberha', province: 'Eastern Cape', matches: ['Gqeberha', 'PE', 'Nelson Mandela Bay'],
    intro: 'The Friendly City lives up to its name. Unbound gives singles and couples in Gqeberha (Port Elizabeth) a private, verified way to meet — without everyone in town knowing your business.',
    vibe: {
      title: 'Dating in Gqeberha',
      body: [
        'Nelson Mandela Bay is the kind of place where you run into people you know. That makes discretion matter: on Unbound, chat photos stay blurred until you reveal them and you can hide your profile with one tap whenever you need a break.',
        'Members here tend to love the outdoors — Hobie Beach, Sardinia Bay and the beachfront along Summerstrand — so mention what you like doing and let your profile start the conversation.',
      ],
    },
    dates: {
      title: 'First-date ideas around Gqeberha',
      body: [
        'A coffee in Richmond Hill, a walk along the Summerstrand beachfront, or a relaxed lunch at the Boardwalk. Busy, public spots are perfect for a first meeting.',
        'Arrange your own transport and keep the first date short and sweet — you can always plan a second.',
      ],
    },
    local: { q: 'Is it “Port Elizabeth” or “Gqeberha” on Unbound?', a: 'Either works. Members can enter their city however they prefer, and searching by distance means you’ll see people across Nelson Mandela Bay regardless of the name they use.' },
  },
  {
    slug: 'bloemfontein', name: 'Bloemfontein', alt: 'Mangaung', province: 'Free State', matches: ['Mangaung', 'Bloem'],
    intro: 'Bloem is the heart of the country — and a place where people value honesty. Unbound connects singles and couples in the Free State with verified members who say what they mean.',
    vibe: {
      title: 'Dating in Bloemfontein',
      body: [
        'In a smaller city, mainstream apps can feel like scrolling through people you already know. Unbound’s privacy tools — snooze, blurred chat photos and incognito browsing on Platinum — help you date without an audience.',
        'Search by distance to include nearby towns, and use your profile prompts to show what makes you you.',
      ],
    },
    dates: {
      title: 'First-date ideas around Bloemfontein',
      body: [
        'A stroll through the Botanical Gardens or Naval Hill, coffee near Loch Logan, or dinner in Westdene. Simple, public and easy to talk over.',
        'Always video-call first and let a friend know your plans with Share My Date.',
      ],
    },
    local: { q: 'Are there many members in the Free State?', a: 'Unbound is still growing outside the big metros, so we won’t make up numbers. If a city has enough members, its page shows a live count. Joining early means you’re visible to every new member who signs up nearby.' },
  },
  {
    slug: 'east-london', name: 'East London', alt: 'Buffalo City', province: 'Eastern Cape', matches: ['Buffalo City', 'Gonubie'],
    intro: 'Easy-going and coastal, East London suits people who like to take their time. Unbound helps singles and couples on the Buffalo City coast meet verified members privately.',
    vibe: {
      title: 'Dating in East London',
      body: [
        'Life in East London tends to revolve around the coast — Nahoon, Orient Beach and the Esplanade. A profile that shows what your weekends look like is the best icebreaker there is.',
        'In a close-knit city, discretion matters. You control who sees your photos and can step away from Unbound at any time by snoozing your profile.',
      ],
    },
    dates: {
      title: 'First-date ideas around East London',
      body: [
        'Coffee in Vincent, a walk along the Esplanade or Nahoon Reef, or a casual lunch by the beach. Public and relaxed is the way to go.',
        'Our Safety Centre has practical first-date tips and South African emergency numbers.',
      ],
    },
    local: { q: 'Can I meet people beyond East London?', a: 'Yes. Widen your search distance to include the wider Eastern Cape — free members can search up to 250 km.' },
  },
  {
    slug: 'polokwane', name: 'Polokwane', province: 'Limpopo', matches: ['Pietersburg'],
    intro: 'Polokwane is growing fast and so is its social scene. Unbound gives singles and couples in Limpopo a private, verified way to meet people with the same intentions.',
    vibe: {
      title: 'Dating in Polokwane',
      body: [
        'Limpopo’s capital mixes city ambition with small-town warmth. On Unbound you can be upfront about what you want — a relationship, something casual or new friends — and filter for people who want the same.',
        'Privacy is built in: photos are watermarked with the viewer’s name, chat photos stay blurred until you reveal them, and you can hide your profile instantly.',
      ],
    },
    dates: {
      title: 'First-date ideas around Polokwane',
      body: [
        'Coffee or lunch at one of the city’s malls or restaurants, or a daytime visit to the Polokwane Game Reserve once you’ve met a few times.',
        'Meet in public first and keep your personal details private until trust is built.',
      ],
    },
    local: { q: 'Is Unbound available outside the big cities?', a: 'Yes — Unbound is open across South Africa. Distance-based search shows you members near Polokwane and, if you like, further afield.' },
  },
  {
    slug: 'nelspruit', name: 'Nelspruit', alt: 'Mbombela', province: 'Mpumalanga', matches: ['Mbombela', 'White River'],
    intro: 'Gateway to the Lowveld and the Kruger, Nelspruit (Mbombela) attracts people who love the outdoors. Unbound helps singles and couples in Mpumalanga meet verified members discreetly.',
    vibe: {
      title: 'Dating in Mbombela',
      body: [
        'Subtropical weather, weekend drives along the Panorama Route and a relaxed pace — the Lowveld suits people who prefer quality over quantity. Unbound’s compatibility scores show you why you might click, not just that you might.',
        'Search by distance to include White River and the surrounding towns.',
      ],
    },
    dates: {
      title: 'First-date ideas around Nelspruit',
      body: [
        'A walk in the Lowveld National Botanical Garden, coffee in town or lunch at Riverside. Save the scenic road trips for once you know each other better.',
        'Share your plans with a friend using Share My Date before you head out.',
      ],
    },
    local: { q: 'Should I list Nelspruit or Mbombela?', a: 'Whichever you prefer. We match both names, and distance-based search means nearby members show up either way.' },
  },
  {
    slug: 'pietermaritzburg', name: 'Pietermaritzburg', alt: 'Msunduzi', province: 'KwaZulu-Natal', matches: ['PMB', 'Maritzburg', 'Msunduzi'],
    intro: 'Historic, green and a little quieter than the coast, Maritzburg is a great place to slow down and get to know someone. Unbound connects verified singles and couples in the Midlands, privately.',
    vibe: {
      title: 'Dating in Pietermaritzburg',
      body: [
        'With a university crowd, long-time locals and easy access to the Midlands Meander, PMB has a mix of people and paces. On Unbound you can be specific about what you’re after and see compatibility at a glance.',
        'Durban is under an hour away, so a wider search radius opens up the whole corridor.',
      ],
    },
    dates: {
      title: 'First-date ideas around Pietermaritzburg',
      body: [
        'A walk in the Botanical Gardens, coffee in the city centre or a relaxed lunch along the Midlands Meander once you’ve met.',
        'Daytime, public and on your own transport — the basics of a safe first date.',
      ],
    },
    local: { q: 'Can I meet people in Durban from Pietermaritzburg?', a: 'Yes. Set your search distance to include Durban and the coast and you’ll see members across the region.' },
  },
  {
    slug: 'stellenbosch', name: 'Stellenbosch', province: 'Western Cape', matches: ['Stellies'],
    intro: 'Oak-lined streets, wine farms and a lively student town — Stellenbosch has a romance all its own. Unbound gives singles and couples in the winelands a discreet, verified place to meet.',
    vibe: {
      title: 'Dating in Stellenbosch',
      body: [
        'Stellies is small enough that everyone seems to know everyone. Unbound’s privacy tools let you date on your own terms: blurred chat photos, protected profile photos and the option to snooze your profile whenever you like.',
        'Cape Town, Paarl and Somerset West are all close by, so you can widen your search radius as far as you want.',
      ],
    },
    dates: {
      title: 'First-date ideas around Stellenbosch',
      body: [
        'Coffee on Church Street or Dorp Street, a walk through Jonkershoek once you know each other, or a tasting at a wine farm — just keep an eye on your drink and arrange your own lift home.',
      ],
    },
    local: { q: 'Is Unbound only for students in Stellenbosch?', a: 'Not at all. Unbound is for every adult 18 and over — students, professionals, singles and couples alike. You choose the age range you want to see.' },
  },
  {
    slug: 'sandton', name: 'Sandton', province: 'Gauteng', matches: ['Sandown', 'Bryanston'],
    intro: 'Africa’s richest square mile runs on busy diaries. Unbound gives professionals and couples in Sandton a discreet, verified place to meet people who value their time — and their privacy.',
    vibe: {
      title: 'Dating in Sandton',
      body: [
        'Long hours, travel and a public profile make discretion a priority for many people in Sandton. Unbound never posts to your social accounts, chat photos stay blurred until you reveal them, and Platinum members can browse incognito.',
        'Status updates such as “Up for coffee” make it easy to let matches know when you’re free — perfect for a lunch-hour meet in Nelson Mandela Square or an after-work drink.',
      ],
    },
    dates: {
      title: 'First-date ideas around Sandton',
      body: [
        'Coffee near the Gautrain station, a drink at a rooftop bar, or dinner around Nelson Mandela Square. Central, busy and easy to get to and from.',
        'Video-call first if diaries are tight — it saves time and confirms you’re meeting who you think you are.',
      ],
    },
    local: { q: 'Can I keep my Unbound profile hidden from colleagues?', a: 'You can snooze your profile at any time, and on Platinum you can browse incognito so you don’t appear in anyone’s “who viewed me” list. You can also block specific people so they never see you.' },
  },
  {
    slug: 'umhlanga', name: 'Umhlanga', province: 'KwaZulu-Natal', matches: ['Umhlanga Rocks', 'Umhlanga Ridge'],
    intro: 'Beachfront promenades and a polished coastal lifestyle — Umhlanga is one of KZN’s favourite places to date. Unbound helps singles and couples here meet verified members, discreetly.',
    vibe: {
      title: 'Dating in Umhlanga',
      body: [
        'From the lighthouse promenade to Gateway and the Ridge, Umhlanga blends holiday energy with busy professional life. Unbound lets you set your intentions clearly and see compatibility scores before you say hello.',
        'Durban, La Lucia and Ballito are all within easy reach, so a slightly wider search radius opens up the whole North Coast.',
      ],
    },
    dates: {
      title: 'First-date ideas around Umhlanga',
      body: [
        'An early-morning walk along the promenade, coffee on Chartwell Drive or sundowners overlooking the ocean. Public, relaxed and beautiful.',
      ],
    },
    local: { q: 'Does Umhlanga include the wider North Coast?', a: 'Search is distance-based, so you’ll see members in La Lucia, Durban North and Ballito as long as they fall within your search radius.' },
  },
];

const BIG_FOUR = ['johannesburg', 'cape-town', 'durban', 'pretoria'];

const COMMON_FAQS = {
  free: { q: 'Is Unbound free to join?', a: 'Yes. Creating a profile, browsing and messaging are free (with a daily message limit). Gold and Platinum add unlimited messaging, private photo access, search anywhere and extra privacy tools — see our pricing page for details.' },
  real: { q: 'How do I know people are real?', a: 'Members can complete a quick selfie check to earn a verified badge, and you can filter for verified profiles. Anyone can block or report a member in two taps, and reports go straight to our moderation team.' },
  age: { q: 'Who can join Unbound?', a: 'Adults 18 and over only. Singles and couples of every gender, orientation and relationship style are welcome, as long as they treat others with respect.' },
};

function cityPage(c: CityInfo): DatingPage {
  const full = c.alt ? `${c.name} (${c.alt})` : c.name;
  const isBig = BIG_FOUR.includes(c.slug);
  const sameProvince = CITIES.filter((o) => o.province === c.province && o.slug !== c.slug).map((o) => o.slug);
  const related = [
    ...sameProvince,
    ...(isBig ? [`couples-${c.slug}`] : []),
    'singles', 'couples', 'lgbtq', 'discreet-dating',
  ];
  return {
    slug: c.slug,
    kind: 'city',
    label: c.name,
    title: `Dating in ${c.name} — Verified Singles & Couples`,
    description: `Meet photo-verified singles and couples in ${full}, ${c.province}. Private, discreet dating with blurred chat photos, protected albums and incognito browsing. Free to join, 18+.`,
    eyebrow: `${c.province} · South Africa`,
    h1: `Private, verified dating in ${c.name}`,
    lead: c.intro,
    sections: [c.vibe, c.dates],
    faqs: [
      { q: `Is Unbound available in ${c.name}?`, a: `Yes. Unbound is open to adults across South Africa, including ${full}. Sign up free, set your location and search distance, and you’ll see members near you.` },
      c.local,
      COMMON_FAQS.real,
      COMMON_FAQS.free,
      COMMON_FAQS.age,
    ],
    cityMatches: [c.name, ...(c.alt ? [c.alt] : []), ...(c.matches ?? [])],
    related,
  };
}

const COUPLES_CITY_NOTES: Record<string, Section> = {
  johannesburg: {
    title: 'For couples in Johannesburg',
    body: [
      'Joburg couples often tell us their biggest challenge is finding like-minded people without risking their privacy at work or in their social circle. On Unbound, a couple profile clearly shows you’re together, so everyone knows what to expect from the first message.',
      'Look out for curated member events — relaxed gatherings where introductions happen naturally, with no pressure.',
    ],
  },
  'cape-town': {
    title: 'For couples in Cape Town',
    body: [
      'Whether you’re looking for new friends for long lunches in the winelands or other couples who share your outlook, Unbound makes it clear from the start that you’re a pair — no awkward explanations.',
      'Cape Town can feel like a small world, so our discreet features matter: you choose which photos are private and who can see them.',
    ],
  },
  durban: {
    title: 'For couples in Durban',
    body: [
      'Durban’s relaxed pace suits couples who like to take their time getting to know people. Your shared profile says who you both are and what you’re open to, so conversations start on the right foot.',
      'Search across eThekwini, from the Berea to Umhlanga and Ballito, and meet somewhere public and easy for a first hello.',
    ],
  },
  pretoria: {
    title: 'For couples in Pretoria',
    body: [
      'Many Pretoria couples value discretion above all. With private albums, blurred chat photos and a snooze switch, you share as much — or as little — as you’re comfortable with.',
      'Johannesburg is close by, so widening your search radius gives you a much bigger community to explore together.',
    ],
  },
};

function couplesCityPage(c: CityInfo): DatingPage {
  return {
    slug: `couples-${c.slug}`,
    kind: 'couples-city',
    label: `Couples in ${c.name}`,
    title: `Couples Dating in ${c.name} — Meet Like-Minded Couples`,
    description: `A private, verified community for couples in ${c.name} to meet other couples and open-minded singles. Shared or linked couple profiles, private albums and discreet controls. 18+.`,
    eyebrow: `Couples · ${c.name}`,
    h1: `Couples dating in ${c.name}, done discreetly`,
    lead: `Unbound is one of the few South African dating communities built for couples as well as singles. Create a shared profile — or link two — and meet other couples and open-minded people in ${c.name} who are looking for the same kind of connection.`,
    sections: [
      COUPLES_CITY_NOTES[c.slug] ?? COUPLES_CITY_NOTES.johannesburg,
      {
        title: 'How couple profiles work',
        body: [
          'You can share one profile as a couple or each keep your own profile and link them together. Either way, your profile shows you’re a couple, and you decide together what you’re open to — friendship, socialising, or more.',
          'Private albums let you keep some photos for people you trust, and you can revoke access at any time.',
        ],
      },
    ],
    faqs: [
      { q: `Can couples join Unbound in ${c.name}?`, a: `Yes. Couples are welcome everywhere on Unbound, including ${c.name}. Create a shared couple profile or link two individual profiles.` },
      { q: 'Do we need one account or two?', a: 'Either. You can share a single couple profile, or each create a profile and link them so members see you as a pair.' },
      { q: 'Can we keep our photos private?', a: 'Yes. Put any photos in a private album and grant access only to members you choose. Chat photos stay blurred until the recipient reveals them, and every photo carries a watermark of the person viewing it.' },
      COMMON_FAQS.real,
      COMMON_FAQS.free,
    ],
    cityMatches: undefined,
    related: [c.slug, ...BIG_FOUR.filter((s) => s !== c.slug).map((s) => `couples-${s}`), 'couples', 'discreet-dating'],
  };
}

const AUDIENCE: DatingPage[] = [
  {
    slug: 'singles', kind: 'audience', label: 'Singles',
    title: 'Dating for Singles in South Africa — Verified & Private',
    description: 'Meet photo-verified singles across South Africa on Unbound. Clear intentions, transparent compatibility scores and privacy built in. Free to join, 18+.',
    eyebrow: 'Singles · South Africa',
    h1: 'Dating for singles who know what they want',
    lead: 'Whether you’re after a relationship, something casual or simply great company, Unbound helps South African singles meet verified people with matching intentions — privately and respectfully.',
    sections: [
      {
        title: 'Intentions, up front',
        body: [
          'Every profile shows what someone is looking for, so you can skip the guessing. Compatibility scores are built from shared interests, intentions, age and distance — and we show you the reasons behind every score.',
          'Profile prompts and icebreakers give you something real to reply to, so conversations get past “hey” quickly.',
        ],
      },
      {
        title: 'Meet couples too — or don’t',
        body: [
          'Unbound welcomes singles and couples. Filters let you choose exactly who you want to see, so your Discover feed matches your intentions.',
        ],
      },
    ],
    faqs: [
      COMMON_FAQS.age,
      { q: 'Can I only see other singles?', a: 'Yes. Use search filters to choose whether you see singles, couples or both.' },
      COMMON_FAQS.real,
      COMMON_FAQS.free,
      { q: 'Which cities is Unbound in?', a: 'Unbound is open across South Africa. You can search by distance from wherever you are; our city pages cover Johannesburg, Cape Town, Durban, Pretoria and more.' },
    ],
    related: ['johannesburg', 'cape-town', 'durban', 'pretoria', 'lgbtq', 'discreet-dating', 'couples'],
  },
  {
    slug: 'couples', kind: 'audience', label: 'Couples',
    title: 'Couples Dating in South Africa — Meet Other Couples',
    description: 'A private, verified community where South African couples can meet other couples and open-minded singles. Shared or linked couple profiles, private albums and events. 18+.',
    eyebrow: 'Couples · South Africa',
    h1: 'A dating community that welcomes couples',
    lead: 'Most dating apps assume you’re single. Unbound was built for couples from day one — so you can meet like-minded couples and singles across South Africa, together and on your own terms.',
    sections: [
      {
        title: 'Built for two',
        body: [
          'Share one profile as a couple, or each keep your own and link them so members see you as a pair. Your profile makes it clear you’re together and what you’re both open to, which keeps every conversation honest.',
          'Curated member events — sundowners, tastings, workshops — offer a relaxed setting to meet people in person.',
        ],
      },
      {
        title: 'Discretion you can rely on',
        body: [
          'Private albums for the photos you only want certain members to see, blurred chat photos, and a snooze switch for when you want a break. We never post to your social accounts.',
        ],
      },
    ],
    faqs: [
      { q: 'Can couples join Unbound?', a: 'Yes — couples are welcome alongside singles. Create a shared couple profile or link two individual profiles.' },
      { q: 'Who will we meet?', a: 'Other couples and singles who are open to meeting couples. Filters let everyone choose who they want to see, so the people you meet are interested in couples too.' },
      { q: 'Can we keep our photos private?', a: 'Yes. Private albums are visible only to members you grant access, and you can revoke access at any time. Every photo is watermarked with the viewer’s name.' },
      COMMON_FAQS.real,
      COMMON_FAQS.free,
    ],
    related: BIG_FOUR.map((s) => `couples-${s}`).concat(['discreet-dating', 'lgbtq', 'singles']),
  },
  {
    slug: 'lgbtq', kind: 'audience', label: 'LGBTQ+',
    title: 'LGBTQ+ Dating in South Africa — Inclusive & Private',
    description: 'Inclusive, private dating for LGBTQ+ singles and couples across South Africa. Share your identity on your terms, with verified profiles and strong privacy controls. 18+.',
    eyebrow: 'LGBTQ+ · South Africa',
    h1: 'LGBTQ+ dating, on your terms',
    lead: 'Unbound is an inclusive community for gay, lesbian, bisexual, trans, non-binary and queer people — single or partnered — across South Africa. Share as much of your identity as you want, with privacy controls that keep you in charge.',
    sections: [
      {
        title: 'Inclusive by design',
        body: [
          'Profiles support a range of genders and orientations, and you decide what to show. Search filters help you find the people you’re interested in, and they find you.',
          'Couples of every kind are welcome, with shared or linked couple profiles.',
        ],
      },
      {
        title: 'Privacy that protects you',
        body: [
          'Not everyone is out to everyone, and that’s OK. Snooze your profile any time, keep photos in private albums, and on Platinum browse incognito. Chat photos stay blurred until you choose to reveal them.',
          'Respect is non-negotiable: block or report anyone in two taps, and our moderation team reviews every report.',
        ],
      },
    ],
    faqs: [
      { q: 'Is Unbound LGBTQ+ friendly?', a: 'Yes. Unbound welcomes people of every gender, orientation and relationship style. Harassment or discrimination breaks our community rules and can get an account removed.' },
      { q: 'Can I control who sees my profile?', a: 'Yes. Use filters to choose who you see, keep photos private, snooze your profile, or block specific people. Platinum adds incognito browsing.' },
      COMMON_FAQS.real,
      COMMON_FAQS.free,
      COMMON_FAQS.age,
    ],
    related: ['johannesburg', 'cape-town', 'durban', 'pretoria', 'discreet-dating', 'singles', 'couples'],
  },
  {
    slug: 'discreet-dating', kind: 'audience', label: 'Discreet dating',
    title: 'Discreet Dating in South Africa — Private & Verified',
    description: 'Private dating for South African singles and couples who value discretion: blurred chat photos, private albums, watermarked photos, incognito browsing and a one-tap snooze. 18+.',
    eyebrow: 'Privacy first',
    h1: 'Discreet dating for people who value privacy',
    lead: 'Your love life is your business. Unbound is designed so you decide who sees you, what they see and when — with honest protections and no posting to your social accounts, ever.',
    sections: [
      {
        title: 'What “discreet” means on Unbound',
        body: [
          'Chat photos arrive blurred until the recipient chooses to reveal them. Profile and album photos can’t be right-clicked or dragged, and carry a subtle watermark of the person viewing them — a strong deterrent against sharing.',
          'Media blurs when you switch apps or windows, and a reminder appears when screenshot shortcuts are pressed. We’re honest: no website can fully stop a screenshot, but we make misuse traceable.',
        ],
      },
      {
        title: 'You’re in control',
        body: [
          'Snooze your profile in one tap. Keep photos in private albums and grant or revoke access per member. Platinum members can browse incognito, so they don’t appear in “who viewed me”.',
        ],
      },
    ],
    faqs: [
      { q: 'Will Unbound post to my social media?', a: 'Never. Unbound doesn’t connect to or post on your social accounts.' },
      { q: 'Can people screenshot my photos?', a: 'No website can completely prevent screenshots. Unbound blocks saving and dragging, blurs media when the app loses focus, and watermarks every photo with the viewer’s name so any leak can be traced.' },
      { q: 'How do I hide my profile?', a: 'Snooze it from your settings and it disappears from search and Discover immediately. Turn it back on whenever you’re ready.' },
      COMMON_FAQS.real,
      COMMON_FAQS.age,
    ],
    related: ['couples', 'lgbtq', 'singles', 'sandton', 'johannesburg', 'cape-town'],
  },
];

export const DATING_PAGES: DatingPage[] = [
  ...CITIES.map(cityPage),
  ...CITIES.filter((c) => BIG_FOUR.includes(c.slug)).map(couplesCityPage),
  ...AUDIENCE,
];

const BY_SLUG = new Map(DATING_PAGES.map((p) => [p.slug, p]));

export function getDatingPage(slug: string): DatingPage | undefined {
  return BY_SLUG.get(slug);
}

/** Anchor text for internal links, e.g. "Dating in Durban", "Couples dating", "Couples in Durban". */
export function linkText(p: DatingPage): string {
  if (p.kind === 'city') return `Dating in ${p.label}`
  if (p.kind === 'couples-city') return p.label
  if (p.slug === 'discreet-dating') return 'Discreet dating'
  return `${p.label} dating`
}
