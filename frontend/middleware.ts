import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/login', '/join', '/forgot-password', '/reset-password',
  '/api/public', '/api/auth/login','/api/manifest', '/checkin'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const hostWithoutPort = host.split(':')[0]
  const parts = hostWithoutPort.split('.')

  const isComAu = parts.slice(-2).join('.') === 'com.au'
  const expectedParts = isComAu ? 4 : 3
  const hasClubSubdomain = parts.length >= expectedParts

  // Root domain — platform landing page + admin routes
  if (!hasClubSubdomain) {
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
      const platformSession = request.cookies.get('platform_session')?.value
      if (!platformSession) {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    }
    return NextResponse.next()
  }

  // Static files — pass through
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

  // Public paths — no auth needed
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Check session cookie
  const loggedIn = request.cookies.get('mg_session')?.value
  if (!loggedIn) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}