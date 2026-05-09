import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/join', '/api/public', '/api/auth/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // Extract club slug from subdomain
  const slug = host.split('.')[0]

  // Pass through public paths
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Pass through Next.js internals and static files
  if (
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon') ||
  pathname.startsWith('/manifest') ||
  pathname.startsWith('/icons') ||
  pathname.endsWith('.png') ||
  pathname.endsWith('.jpg') ||
  pathname.endsWith('.svg') ||
  pathname.endsWith('.ico') ||
  pathname.endsWith('.webp')
  ) {
    return NextResponse.next()
  }

  // Check for auth token in cookie (set on login)
  // Note: we store a lightweight "logged_in" cookie for middleware checks.
  // The actual JWT stays in localStorage (client-only).
  const loggedIn = request.cookies.get('mg_session')?.value

  if (!loggedIn && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Forward club slug to API proxy routes via header
  const response = NextResponse.next()
  response.headers.set('x-club-slug', slug)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
