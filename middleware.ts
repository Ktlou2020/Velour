import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const protectedPaths = ['/members', '/discover', '/matches', '/messages', '/events', '/forums', '/profile', '/upgrade', '/onboarding', '/admin', '/views', '/gallery', '/account', '/notifications', '/spark', '/insights', '/subscription', '/reviews', '/store']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth/')
  // Pages a signed-in member must still reach (confirming their email, signing out).
  const authPassThrough = ['/auth/signout', '/auth/verify-email', '/auth/confirm-email']

  if (isProtected && !isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl.origin)
    return NextResponse.redirect(signinUrl)
  }
  // New members confirm their email before using the site (REQUIRE_EMAIL_VERIFICATION=true).
  const user = req.auth?.user as { role?: string; emailConfirmed?: boolean } | undefined
  if (
    isLoggedIn && isProtected && process.env.REQUIRE_EMAIL_VERIFICATION === 'true' &&
    user?.emailConfirmed === false && user?.role !== 'ADMIN'
  ) {
    return NextResponse.redirect(new URL('/auth/confirm-email', req.nextUrl.origin))
  }
  if (isAuthPage && isLoggedIn && !authPassThrough.some((p) => pathname.startsWith(p))) {
    const membersUrl = new URL('/members', req.nextUrl.origin)
    return NextResponse.redirect(membersUrl)
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
