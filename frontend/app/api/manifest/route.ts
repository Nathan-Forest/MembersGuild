import { NextRequest } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const slug = host.split('.')[0]

  let clubName     = 'MembersGuild'
  let primaryColor = '#1a2744'

  if (slug && slug !== 'membersguild' && slug !== 'www') {
    try {
      const res = await fetch(`${BACKEND}/api/public/club-config`, {
        headers: { 'X-Club-Slug': slug },
        cache:   'no-store',
      })
      if (res.ok) {
        const config  = await res.json()
        clubName      = config.displayName  ?? clubName
        primaryColor  = config.primaryColor ?? primaryColor
      }
    } catch {}
  }

  const manifest = {
    name:             clubName,
    short_name:       clubName,
    description:      `${clubName} member portal`,
    start_url:        '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      primaryColor,
    orientation:      'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type':  'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}