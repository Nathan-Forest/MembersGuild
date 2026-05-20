import { createPlatformSession } from '@/lib/platform-auth'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (password !== process.env.PLATFORM_ADMIN_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 })
  }

  const session = createPlatformSession()

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `platform_session=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${8 * 60 * 60}`
    }
  })
}