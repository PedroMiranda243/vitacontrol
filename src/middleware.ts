import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })
  
  const isLoggedIn = !!token
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isApiAuth = pathname.startsWith('/api/auth')
  const isRootPage = pathname === '/'

  // Allow API auth routes
  if (isApiAuth) {
    return NextResponse.next()
  }

  // Redirect logged-in users away from login page
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow login page
  if (isLoginPage) {
    return NextResponse.next()
  }

  // Redirect root to dashboard or login
  if (isRootPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Check admin-only routes
  const adminOnlyRoutes = ['/upload']
  const isAdminRoute = adminOnlyRoutes.some(route => 
    pathname.startsWith(route)
  )

  if (isAdminRoute && token?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
