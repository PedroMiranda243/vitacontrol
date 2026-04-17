import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
  const isRootPage = req.nextUrl.pathname === '/'

  // Allow API auth routes
  if (isApiAuth) {
    return NextResponse.next()
  }

  // Redirect logged-in users away from login page
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Allow login page
  if (isLoginPage) {
    return NextResponse.next()
  }

  // Redirect root to dashboard or login
  if (isRootPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check admin-only routes
  const adminOnlyRoutes = ['/upload']
  const isAdminRoute = adminOnlyRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  if (isAdminRoute && req.auth?.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
