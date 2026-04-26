import type { AuthUser, UserRole } from '@/types'

const TOKEN_KEY = 'mg_token'

// ─── Token storage ────────────────────────────────────────────────────────────
// Stored in localStorage. For SSR pages that need auth, the token is passed
// via Authorization header from client components.

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ─── JWT parsing (client-side only, no verification) ─────────────────────────

interface JwtPayload {
  sub: string
  email: string
  club_id: string
  club_slug: string
  role: string
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string
  exp: number
}

export function parseToken(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))

    // ASP.NET maps ClaimTypes.Role to a long URI key in the JWT
    // Normalise it to just 'role' for frontend use
    const roleUri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
    if (!decoded.role && decoded[roleUri]) {
      decoded.role = decoded[roleUri]
    }

    return decoded as JwtPayload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseToken(token)
  if (!payload) return true
  return Date.now() / 1000 > payload.exp
}

export function getCurrentUser(): (JwtPayload & { isAuthenticated: true }) | null {
  const token = getToken()
  if (!token) return null
  if (isTokenExpired(token)) {
    clearToken()
    return null
  }
  const payload = parseToken(token)
  if (!payload) return null
  return { ...payload, isAuthenticated: true }
}

// ─── Role checks ──────────────────────────────────────────────────────────────

export function hasRole(requiredRoles: UserRole[]): boolean {
  const user = getCurrentUser()
  if (!user) return false
  return requiredRoles.includes(user.role)
}

export function requireAuth(): void {
  if (typeof window === 'undefined') return
  const user = getCurrentUser()
  if (!user) {
    window.location.href = '/login'
  }
}

export function logout(): void {
  clearToken()
  window.location.href = '/login'
}
