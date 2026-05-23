import { NextRequest } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const slug = host.split('.')[0]

  let clubName = 'MembersGuild'
  let primaryColor = '#1a2744'
  let icon192Url: string | null = null
  let icon512Url: string | null = null

  if (slug && slug !== 'membersguild' && slug !== 'www') {
    try {
      const res = await fetch(`${BACKEND}/api/public/club-config`, {
        headers: { 'X-Club-Slug': slug },
        cache: 'no-store',
      })
      if (res.ok) {
        const config = await res.json()
        clubName = config.displayName ?? clubName
        primaryColor = config.primaryColor ?? primaryColor
        icon192Url = config.pwaIcon192Url ?? null
        icon512Url = config.pwaIcon512Url ?? null
      }
    } catch { }
  }

  // Use club's S3 icons if uploaded, otherwise fall back to default
  const icons = (icon192Url && icon512Url)
    ? [
      { src: icon192Url, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: icon512Url, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]
    : [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]

  const manifest = {
    name: clubName,
    short_name: clubName,
    description: `${clubName} member portal`,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: primaryColor,
    orientation: 'portrait',
    icons,
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}