import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const protectedPaths = ['/members', '/discover', '/messages', '/events', '/forums', '/profile', '/upgrade']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth/')

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/members', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
