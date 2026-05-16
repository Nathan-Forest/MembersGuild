import type { UserRole } from '@/types'

const TOKEN_KEY = 'mg_token'

// ─── Token storage ────────────────────────────────────────────────────────────

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

// ─── JWT parsing ──────────────────────────────────────────────────────────────

const ROLE_URI = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

interface JwtPayload {
  sub: string
  email: string
  club_id: string
  club_slug: string
  role?: string
  [ROLE_URI]?: string
  exp: number
  firstName?: string
  lastName?: string
}

export interface ParsedUser {
  sub: string
  email: string
  club_id: string
  club_slug: string
  role: UserRole
  exp: number
  firstName: string 
  lastName: string 
  isAuthenticated: true
}

export function parseToken(token: string): ParsedUser | null {
  try {
    const payload = token.split('.')[1]
    const decoded: JwtPayload = JSON.parse(atob(payload))

    // ASP.NET Core maps ClaimTypes.Role to a long URI key in the JWT.
    // Normalise it to 'role' for frontend use.
    const role = (decoded.role ?? decoded[ROLE_URI] ?? '') as UserRole

    return {
      sub:            decoded.sub,
      email:          decoded.email,
      club_id:        decoded.club_id,
      club_slug:      decoded.club_slug,
      role,
      exp:            decoded.exp,
      firstName:       decoded.firstName ?? '',
      lastName:        decoded.lastName  ?? '',
      isAuthenticated: true,
    }
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseToken(token)
  if (!payload) return true
  return Date.now() / 1000 > payload.exp
}

export function getCurrentUser(): ParsedUser | null {
  const token = getToken()
  if (!token) return null
  if (isTokenExpired(token)) {
    clearToken()
    return null
  }
  return parseToken(token)
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
  if (!user) window.location.href = '/login'
}

export function logout(): void {
  clearToken()
  document.cookie = 'mg_session=; path=/; max-age=0'
  window.location.href = '/login'
}