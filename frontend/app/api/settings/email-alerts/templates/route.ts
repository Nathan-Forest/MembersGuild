import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/email-alerts/templates`, {
    headers: { 'X-Club-Slug': req.headers.get('x-club-slug') || '', 'Authorization': req.headers.get('authorization') || '' }
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(req: NextRequest) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/email-alerts/templates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Club-Slug': req.headers.get('x-club-slug') || '', 'Authorization': req.headers.get('authorization') || '' },
    body: await req.text()
  })
  return NextResponse.json(await res.json(), { status: res.status })
}