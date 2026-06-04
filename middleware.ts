import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const protectedPaths = ['/members', '/discover', '/messages', '/events', '/forums', '/profile', '/upgrade', '/onboarding']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth/')

  if (isProtected && !isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl.origin)
    return NextResponse.redirect(signinUrl)
  }
  if (isAuthPage && isLoggedIn) {
    const membersUrl = new URL('/members', req.nextUrl.origin)
    return NextResponse.redirect(membersUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
