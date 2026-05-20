import { verifyPlatformSession } from '@/lib/platform-auth'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const cookieStore = await cookies()
  const session = cookieStore.get('platform_session')?.value

  if (!verifyPlatformSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await params
  const url = `${BACKEND}/platform/${path.join('/')}${req.nextUrl.search}`

  const res = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Platform-Key': process.env.PLATFORM_API_KEY!,
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
    cache: 'no-store',
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export const GET    = handler
export const POST   = handler
export const PUT    = handler
export const DELETE = handler