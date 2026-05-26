import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

export async function POST(req: NextRequest) {
  const body = await req.text() // raw body required for Stripe signature verification
  const res = await fetch(`${BACKEND}/platform/stripe/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': req.headers.get('stripe-signature') ?? '',
    },
    body,
  })
  return new NextResponse(await res.text(), { status: res.status })
}