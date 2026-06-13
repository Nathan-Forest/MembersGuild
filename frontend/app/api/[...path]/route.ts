import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const backendPath = path.join('/')

  // Platform admin routes — bypass club auth, use X-Platform-Key
  if (backendPath.startsWith('platform/')) {
    const platformUrl = `${BACKEND_URL}/${backendPath}${request.nextUrl.search}`
    const res = await fetch(platformUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Platform-Key': process.env.PLATFORM_API_KEY ?? '',
      },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' }
    })
  }

  // Square OAuth callback — bypass club auth, forward directly to backend
  if (backendPath.startsWith('square/callback')) {
    const callbackUrl = `${BACKEND_URL}/api/${backendPath}${request.nextUrl.search}`
    const res = await fetch(callbackUrl, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',  // ← don't follow redirects — pass them through
      cache: 'no-store',
    })

    // If backend returns a redirect, forward it to the browser
    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      const location = res.headers.get('location')
      if (location) {
        return NextResponse.redirect(location)
      }
    }

    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' }
    })
  }

  // ... existing handler logic continues unchanged below

  const host = request.headers.get('host') ?? ''
  console.log('[PROXY] host:', host, 'path:', backendPath)
  const slug = host.split('.')[0]

  const url = new URL(`${BACKEND_URL}/api/${backendPath}`)
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  const contentType = request.headers.get('content-type') ?? ''
  const isMultipart = contentType.includes('multipart/form-data')

  const forwardHeaders = new Headers()
  forwardHeaders.set('X-Club-Slug', slug)

  // For multipart uploads, forward the original Content-Type (includes boundary).
  // For everything else, force JSON.
  if (isMultipart) {
    forwardHeaders.set('Content-Type', contentType)
  } else {
    forwardHeaders.set('Content-Type', 'application/json')
  }

  const auth = request.headers.get('Authorization')
  if (auth) forwardHeaders.set('Authorization', auth)

  let body: BodyInit | undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (isMultipart) {
      // Preserve binary data — text() would corrupt it
      body = await request.blob()
    } else {
      body = await request.text()
    }
  }

  const backendResponse = await fetch(url.toString(), {
    method: request.method,
    headers: forwardHeaders,
    body,
    cache: 'no-store',
  })

  const responseBody = await backendResponse.text()

  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: {
      'Content-Type': backendResponse.headers.get('Content-Type') ?? 'application/json',
    },
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler