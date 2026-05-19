import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const backendPath = path.join('/')

  const host = request.headers.get('host') ?? ''
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

export const GET    = handler
export const POST   = handler
export const PUT    = handler
export const PATCH  = handler
export const DELETE = handler