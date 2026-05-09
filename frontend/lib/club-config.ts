import type { ClubConfig } from '@/types'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

/**
 * Fetched server-side in layout.tsx on every club request.
 * Uses the host header to determine the club slug.
 * Result is passed down to inject CSS variables and nav config.
 */
export async function getClubConfig(host: string): Promise<ClubConfig | null> {
  const hostWithoutPort = host.split(':')[0]
  const parts = hostWithoutPort.split('.')

  // membersguild.com.au = 3 parts → no slug
  // forestden.membersguild.com.au = 4 parts → slug is "forestden"
  // localhost = 1 part → no slug
  const isComAu = parts.slice(-2).join('.') === 'com.au'
  const expectedParts = isComAu ? 4 : 3

  const slug = parts.length >= expectedParts ? parts[0] : null

  if (!slug || slug === 'www' || slug === 'localhost' || /^\d+$/.test(slug)) {
    return null
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/public/club-config`, {
      headers: { 'X-Club-Slug': slug },
      next: { revalidate: 60 },
    })
    if (!response.ok) return null
    return response.json() as Promise<ClubConfig>
  } catch {
    console.error(`Failed to fetch club config for slug: ${slug}`)
    return null
  }
}

/**
 * Generates the CSS custom properties string to inject into <head>.
 * These drive all club-specific colour throughout the UI.
 */
export function buildCssVariables(config: ClubConfig): string {
  return `
    :root {
      --color-primary: ${config.primaryColor};
      --color-secondary: ${config.secondaryColor};
      --color-primary-hover: ${darkenHex(config.primaryColor, 15)};
    }
  `.trim()
}

/** Naively darkens a hex colour by reducing each channel. */
function darkenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - amount)
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - amount)
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - amount)
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}
