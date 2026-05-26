import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

export async function GET() {
  const res = await fetch(`${BACKEND}/api/register/packages`, { cache: 'no-store' })
  return NextResponse.json(await res.json(), { status: res.status })
}