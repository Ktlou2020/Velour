/** Canonical site URL used for metadata, sitemap and robots. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://unboundza.com'
).replace(/\/+$/, '');

export const SITE_NAME = 'Unbound';
export const SITE_TAGLINE = 'Where Connections Become Extraordinary';
export const SITE_DESCRIPTION =
  'Unbound is a private, members-first dating community for singles and couples in South Africa. Photo-verified profiles, discreet privacy controls and curated events — 18+ only.';
