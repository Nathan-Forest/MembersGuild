import { createHmac, timingSafeEqual } from 'crypto'

export function createPlatformSession(): string {
  const timestamp = Date.now().toString()
  const sig = createHmac('sha256', process.env.PLATFORM_API_KEY!)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${sig}`
}

export function verifyPlatformSession(cookie: string | undefined): boolean {
  if (!cookie) return false
  const [timestamp, sig] = cookie.split('.')
  if (!timestamp || !sig) return false

  const age = Date.now() - parseInt(timestamp)
  if (age > 8 * 60 * 60 * 1000) return false // 8 hour expiry

  const expected = createHmac('sha256', process.env.PLATFORM_API_KEY!)
    .update(timestamp)
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}