'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const searchParams               = useSearchParams()
  const token                      = searchParams.get('token') ?? ''
  const [password,    setPassword] = useState('')
  const [confirm,     setConfirm]  = useState('')
  const [loading,     setLoading]  = useState(false)
  const [error,       setError]    = useState('')
  const [success,     setSuccess]  = useState(false)

  async function handleSubmit() {
    if (!password) { setError('Please enter a new password'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true); setError('')

    const res  = await fetch('/api/public/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, password }),
    })
    const data = await res.json()

    if (res.ok) {
      setSuccess(true)
    } else {
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-500 text-sm mb-4">Invalid or missing reset token.</p>
        <a href="/forgot-password"
          className="text-[var(--color-primary,#1a2744)] font-medium hover:underline text-sm">
          Request a new reset link
        </a>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h2>
        <p className="text-gray-500 text-sm mb-6">You can now sign in with your new password.</p>
        <a href="/login"
          className="block w-full bg-[var(--color-primary,#1a2744)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition-opacity">
          Sign in
        </a>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set a new password</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Minimum 8 characters"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Repeat your password"
            className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)] ${
              confirm && password !== confirm ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[var(--color-primary,#1a2744)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg,#f3f4f6)] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}