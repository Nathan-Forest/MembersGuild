'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi } from '@/lib/api'
import { setToken, getCurrentUser } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already logged in, redirect
  useEffect(() => {
    if (getCurrentUser()) router.replace(from)
  }, [from, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authApi.login(email, password)
      setToken(result.token)

      // Set a lightweight session cookie so middleware can check auth
      // The actual JWT stays in localStorage only
      document.cookie = `mg_session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`

      window.location.href = from
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">

        {/* Club branding — logo and name injected via CSS vars in parent layout */}
        <div className="text-center mb-8">
          <div
            className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            M
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Member Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              New here?{' '}
              <a href="/join" className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                Come and Try — register for free
              </a>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by{' '}
          <a href="https://membersguild.com.au" className="hover:underline">MembersGuild</a>
        </p>
      </div>
    </div>
  )
}
