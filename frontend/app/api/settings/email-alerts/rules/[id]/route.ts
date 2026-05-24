import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/email-alerts/rules/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Club-Slug': req.headers.get('x-club-slug') || '', 'Authorization': req.headers.get('authorization') || '' },
    body: await req.text()
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/email-alerts/rules/${id}`, {
    method: 'DELETE', headers: { 'X-Club-Slug': req.headers.get('x-club-slug') || '', 'Authorization': req.headers.get('authorization') || '' }
  })
  return NextResponse.json(await res.json(), { status: res.status })
}