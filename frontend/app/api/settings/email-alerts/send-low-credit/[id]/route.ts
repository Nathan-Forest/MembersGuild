import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/email-alerts/send-low-credit/${params.id}`, {
    method: 'POST', headers: { 'X-Club-Slug': req.headers.get('x-club-slug') || '', 'Authorization': req.headers.get('authorization') || '' }
  })
  return NextResponse.json(await res.json(), { status: res.status })
}