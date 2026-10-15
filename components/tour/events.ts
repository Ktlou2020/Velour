// Tiny, dependency-free bridge so any component (e.g. the Navbar's
// "Take the tour" entry) can start the tour without importing its UI.
export const TOUR_START_EVENT = 'hush:tour:start'

/** Paths where the tour may open automatically for a brand-new member. */
export const TOUR_AUTO_PATHS = ['/members', '/discover']

export const tourDoneKey = (userId: string) => `hush.tour.done:${userId}`

export function startTour() {
  if (typeof window === 'undefined') return
  // Let menus that triggered this close (and the layout settle) first.
  window.setTimeout(() => window.dispatchEvent(new Event(TOUR_START_EVENT)), 60)
}
