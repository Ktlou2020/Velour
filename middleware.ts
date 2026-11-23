import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { hiddenRoute } from '@/lib/features'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const protectedPaths = ['/members', '/discover', '/matches', '/messages', '/events', '/forums', '/profile', '/upgrade', '/onboarding', '/admin', '/views', '/gallery', '/account', '/notifications', '/spark', '/insights', '/subscription', '/reviews', '/store', '/invite']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth/')
  // Pages a signed-in member must still reach (confirming their email, signing out).
  const authPassThrough = ['/auth/signout', '/auth/verify-email', '/auth/confirm-email', '/auth/admin-verify']

  if (isProtected && !isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl.origin)
    return NextResponse.redirect(signinUrl)
  }
  const user = req.auth?.user as { role?: string; emailConfirmed?: boolean; profileReady?: boolean; adminPending?: boolean } | undefined
  // Admins who still need to enter their two-step code keep their admin exemptions here.
  const isAdminish = user?.role === 'ADMIN' || user?.adminPending === true
  // Members finish the basics and add a photo before browsing or messaging
  // (lib/profile-ready.ts). Profile, settings, plans and safety stay reachable.
  const needsProfile = ['/members', '/discover', '/matches', '/messages', '/events', '/forums', '/notifications', '/gallery']
  if (
    isLoggedIn && user?.profileReady === false && !isAdminish &&
    (pathname === '/' || needsProfile.some((p) => pathname === p || pathname.startsWith(p + '/')))
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.nextUrl.origin))
  }
  // New members confirm their email before browsing or messaging
  // (REQUIRE_EMAIL_VERIFICATION=true). They can finish onboarding and edit their
  // profile and settings first, so sign-up isn't lost while they find the email.
  const beforeConfirm = ['/onboarding', '/profile', '/account']
  if (
    isLoggedIn && isProtected && process.env.REQUIRE_EMAIL_VERIFICATION === 'true' &&
    user?.emailConfirmed === false && !isAdminish &&
    !beforeConfirm.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.redirect(new URL('/auth/confirm-email', req.nextUrl.origin))
  }
  // The logo / home links point at "/" — signed-in members belong on their home feed, not the public landing.
  if (pathname === '/' && isLoggedIn) {
    return NextResponse.redirect(new URL('/members', req.nextUrl.origin))
  }
  if (isAuthPage && isLoggedIn && !authPassThrough.some((p) => pathname.startsWith(p))) {
    const membersUrl = new URL('/members', req.nextUrl.origin)
    return NextResponse.redirect(membersUrl)
  }

  // Sections switched off in the simple platform (lib/features.ts). Admins can still preview them.
  if (isLoggedIn && hiddenRoute(pathname) && user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/members', req.nextUrl.origin))
  }

  // Admin two-step login: password done, code not entered yet.
  if (pathname.startsWith('/admin') && user?.adminPending) {
    const url = new URL('/auth/admin-verify', req.nextUrl.origin)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Admin-only paths
  if (pathname.startsWith('/admin')) {
    const role = (req.auth?.user as { role?: string } | undefined)?.role
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/members', req.nextUrl.origin))
    }
  }

  return NextResponse.next()
})

export const config = {
  // Node.js runtime (stable since Next 15.5): the auth jwt callback re-reads
  // role/isActive from Postgres via Prisma, which cannot run on the edge.
  runtime: 'nodejs',
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
