import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const protectedPaths = ['/members', '/discover', '/messages', '/events', '/forums', '/profile', '/upgrade', '/onboarding', '/admin', '/views', '/gallery', '/account']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth/')

  if (isProtected && !isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl.origin)
    return NextResponse.redirect(signinUrl)
  }
  if (isAuthPage && isLoggedIn && pathname !== '/auth/signout') {
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
