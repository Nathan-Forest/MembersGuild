'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

type CheckinState = 'loading' | 'success' | 'error' | 'login-required'

export default function CheckinPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [state, setState] = useState<CheckinState>('loading')
  const [message, setMessage] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setMessage('Invalid QR code'); return }

    const user = getCurrentUser()
    if (!user) {
      setState('login-required')
      return
    }

    checkin()
  }, [token])

  async function checkin() {
    setState('loading')
    try {
      const result = await api.post<{ message: string; sessionTitle: string }>(
        '/attendance/checkin', token
      )
      setSessionTitle(result.sessionTitle)
      setMessage(result.message)
      setState('success')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Check-in failed')
      setState('error')
    }
  }

  function goToLogin() {
    const from = encodeURIComponent(`/checkin?token=${encodeURIComponent(token ?? '')}`)
    router.push(`/login?from=${from}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm text-center p-8">

        {state === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 animate-pulse"
              style={{ backgroundColor: 'var(--color-primary)' }} />
            <p className="font-semibold text-gray-900">Checking you in…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">You&apos;re checked in!</h1>
            <p className="text-sm text-gray-500 mb-6">{sessionTitle}</p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary w-full py-3">
              Go to Dashboard
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Check-in failed</h1>
            <p className="text-sm text-red-500 mb-6">{message}</p>
            <button onClick={() => router.push('/calendar')} className="btn-secondary w-full py-3">
              Back to Calendar
            </button>
          </>
        )}

        {state === 'login-required' && (
          <>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">
              🔒
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in to check in</h1>
            <p className="text-sm text-gray-500 mb-6">
              You need to be signed in to your member account to complete check-in
            </p>
            <button onClick={goToLogin} className="btn-primary w-full py-3">
              Sign In
            </button>
          </>
        )}
      </div>
    </div>
  )
}