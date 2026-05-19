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
  [ROLE_URI]?: string | string[]
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
  permissions: string[]
  exp: number
  firstName: string
  lastName: string
  isAuthenticated: true
}

export function parseToken(token: string): ParsedUser | null {
  try {
    const payload = token.split('.')[1]
    const decoded: JwtPayload = JSON.parse(atob(payload))

    // Display role — always the stored role name
    const role = (decoded.role ?? '') as UserRole

    // Permissions — base roles for checking access
    // ClaimTypes.Role can be string (standard) or string[] (custom/inherited)
    const rawRoleUri = decoded[ROLE_URI]
    const permissions: string[] = Array.isArray(rawRoleUri)
      ? rawRoleUri
      : rawRoleUri ? [rawRoleUri]
        : role ? [role] : []

    return {
      sub: decoded.sub,
      email: decoded.email,
      club_id: decoded.club_id,
      club_slug: decoded.club_slug,
      role,
      permissions,
      firstName: decoded.firstName ?? '',
      lastName: decoded.lastName ?? '',
      exp: decoded.exp,
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

export function hasPermission(user: ParsedUser, ...roles: string[]): boolean {
  return roles.some(r => user.permissions.includes(r))
}