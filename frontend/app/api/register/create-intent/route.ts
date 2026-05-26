import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

export async function POST(req: NextRequest) {
  const res = await fetch(`${BACKEND}/api/register/create-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await req.text(),
    cache: 'no-store',
  })
  return NextResponse.json(await res.json(), { status: res.status })
}