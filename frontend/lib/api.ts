import { getToken, clearToken } from './auth'

// All API calls go through /api/* proxy routes in Next.js — never directly to the backend.
// The proxy routes add X-Club-Slug and forward the request to the C# API.

const BASE = '/api'

interface FetchOptions extends RequestInit {
  auth?: boolean   // default true — attach JWT
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { auth = true, ...init } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  }

  if (auth) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  // Token expired or invalid — force logout
  if (response.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Unauthorised')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error ?? 'Request failed')
  }

  // 204 No Content
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: FetchOptions) =>
    request<T>(path, { method: 'GET', ...opts }),

  post: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),

  put: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...opts }),

  patch: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),

  delete: <T>(path: string, opts?: FetchOptions) =>
    request<T>(path, { method: 'DELETE', ...opts }),
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: import('@/types').AuthUser }>(
      '/auth/login', { email, password }, { auth: false }
    ),

  profile: () =>
    api.get<import('@/types').AuthUser>('/auth/profile'),
}

// ─── Public (no auth) ─────────────────────────────────────────────────────────

export const publicApi = {
  clubConfig: () =>
    api.get<import('@/types').ClubConfig>('/public/club-config', { auth: false }),

  catsFormFields: () =>
    api.get<import('@/types').CatsFormField[]>('/public/cats-form-fields', { auth: false }),

  catsSignup: (data: unknown) =>
    api.post('/public/signup', data, { auth: false }),
  
}

export const creditsApi = {
  myAccount: () =>
    api.get<import('@/types').MyAccountResponse>('/credits/my-account'),

  adjust: (data: import('@/types/index').AdjustCreditsRequest) =>
    api.post('/credits/adjust', data),

  allBalances: () =>
    api.get('/credits/balances'),

  allTransactions: (userId?: number) =>
    api.get(`/credits/transactions${userId ? `?userId=${userId}` : ''}`),
}