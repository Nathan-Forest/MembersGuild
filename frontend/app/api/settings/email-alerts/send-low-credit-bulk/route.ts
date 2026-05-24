import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/email-alerts/send-low-credit-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Club-Slug': req.headers.get('x-club-slug') || '',
      'Authorization': req.headers.get('authorization') || ''
    },
    body: await req.text()
  })
  return NextResponse.json(await res.json(), { status: res.status })
}