/**
 * Optional sections of the member experience. The simple platform keeps the
 * core loop (browse members → message) plus Discover, Matches, Events and
 * Forums; the sections below are switched off: hidden from navigation, and
 * their pages redirect to /members. Nothing is deleted, so a section comes
 * back by listing it in NEXT_PUBLIC_ENABLED_FEATURES (comma separated, set at
 * build time), e.g. NEXT_PUBLIC_ENABLED_FEATURES=store,spark
 */
export type Feature =
  | 'store' // Toystory shop
  | 'spark' // Daily Spark question
  | 'explore' // public photo feed (/gallery/explore)
  | 'insights' // profile analytics
  | 'views' // who viewed me
  | 'reviews' // member reviews
  | 'invite' // invite-a-friend referrals
  | 'chatExtras' // chat games, voice notes, view-once, priority messages, expiry timers

const ENABLED = new Set(
  (process.env.NEXT_PUBLIC_ENABLED_FEATURES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

export function featureOn(f: Feature): boolean {
  return ENABLED.has(f)
}

/** Member pages that belong to a switched-off section (prefix match). */
export const FEATURE_ROUTES: { prefix: string; feature: Feature }[] = [
  { prefix: '/store', feature: 'store' },
  { prefix: '/spark', feature: 'spark' },
  { prefix: '/gallery/explore', feature: 'explore' },
  { prefix: '/insights', feature: 'insights' },
  { prefix: '/views', feature: 'views' },
  { prefix: '/reviews', feature: 'reviews' },
  { prefix: '/invite', feature: 'invite' },
]

export function hiddenRoute(pathname: string): boolean {
  return FEATURE_ROUTES.some(
    (r) => (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) && !featureOn(r.feature),
  )
}
