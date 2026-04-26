import { NextRequest, NextResponse } from 'next/server'

/**
 * Catch-all proxy route: /api/[...path]
 *
 * Every browser request to /api/* is intercepted here and forwarded to the
 * C# backend at BACKEND_URL. This means:
 *   - No CORS configuration needed on the backend
 *   - The browser never knows the backend URL
 *   - X-Club-Slug is always injected server-side
 *
 * The club slug comes from the request host (bsm.membersguild.com.au → "bsm").
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const backendPath = path.join('/')

  const host = request.headers.get('host') ?? ''
  const slug = host.split('.')[0]

  // Build backend URL
  const url = new URL(`${BACKEND_URL}/api/${backendPath}`)

  // Forward query string
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  // Forward headers — inject club slug, strip Next.js internal headers
  const forwardHeaders = new Headers()
  forwardHeaders.set('X-Club-Slug', slug)
  forwardHeaders.set('Content-Type', 'application/json')

  const auth = request.headers.get('Authorization')
  if (auth) forwardHeaders.set('Authorization', auth)

  const body = request.method !== 'GET' && request.method !== 'HEAD'
    ? await request.text()
    : undefined

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

export const GET     = handler
export const POST    = handler
export const PUT     = handler
export const PATCH   = handler
export const DELETE  = handler
