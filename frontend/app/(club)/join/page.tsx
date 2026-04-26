'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { publicApi } from '@/lib/api'
import type { CatsFormField } from '@/types'

export default function JoinPage() {
  const router = useRouter()

  const [fields, setFields] = useState<CatsFormField[]>([])
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ generatedPassword?: string } | null>(null)

  useEffect(() => {
    publicApi.catsFormFields().then(setFields).catch(() => {})
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleCustomChange(key: string, value: string) {
    setCustomFields(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password || undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      }

      const result: any = await publicApi.catsSignup(payload)

      setSuccess({
        generatedPassword: result.generatedPassword || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">You're registered!</h2>
            <p className="text-gray-500 text-sm">
              Welcome to the club. Your CATS membership is active with 3 free sessions.
            </p>

            {success.generatedPassword && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-left">
                <p className="text-sm font-semibold text-amber-800 mb-1">Your temporary password</p>
                <p className="font-mono text-lg text-amber-900">{success.generatedPassword}</p>
                <p className="text-xs text-amber-700 mt-2">Save this — you won't see it again. Change it after your first login.</p>
              </div>
            )}

            <button
              onClick={() => router.push('/login')}
              className="btn-primary w-full py-2.5 mt-2"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div
            className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            C
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Come and Try</h1>
          <p className="mt-1 text-sm text-gray-500">
            Register for a free trial membership and get 3 complimentary sessions
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Fixed required fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name <span className="text-red-500">*</span></label>
                <input name="firstName" type="text" required className="input"
                  value={form.firstName} onChange={handleChange} disabled={loading} />
              </div>
              <div>
                <label className="label">Last name <span className="text-red-500">*</span></label>
                <input name="lastName" type="text" required className="input"
                  value={form.lastName} onChange={handleChange} disabled={loading} />
              </div>
            </div>

            <div>
              <label className="label">Email address <span className="text-red-500">*</span></label>
              <input name="email" type="email" required className="input"
                value={form.email} onChange={handleChange} disabled={loading} />
            </div>

            <div>
              <label className="label">Phone <span className="text-red-500">*</span></label>
              <input name="phone" type="tel" required className="input"
                value={form.phone} onChange={handleChange} disabled={loading} />
            </div>

            <div>
              <label className="label">Password <span className="text-gray-400 font-normal">(optional — we'll generate one)</span></label>
              <input name="password" type="password" className="input"
                value={form.password} onChange={handleChange} disabled={loading} />
            </div>

            {form.password && (
              <div>
                <label className="label">Confirm password</label>
                <input name="confirmPassword" type="password" className="input"
                  value={form.confirmPassword} onChange={handleChange} disabled={loading} />
              </div>
            )}

            {/* Dynamic club-configured fields */}
            {fields.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <p className="text-sm font-medium text-gray-700">About you</p>

                {fields.map(field => (
                  <div key={field.fieldKey}>
                    <label className="label">
                      {field.fieldLabel}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.fieldType === 'select' && field.fieldOptions ? (
                      <select
                        required={field.isRequired}
                        className="input"
                        value={customFields[field.fieldKey] ?? ''}
                        onChange={e => handleCustomChange(field.fieldKey, e.target.value)}
                        disabled={loading}
                      >
                        <option value="">Select…</option>
                        {field.fieldOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.fieldType === 'boolean' ? (
                      <div className="flex gap-4 mt-1">
                        {['Yes', 'No'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={field.fieldKey}
                              value={opt}
                              required={field.isRequired}
                              checked={customFields[field.fieldKey] === opt}
                              onChange={() => handleCustomChange(field.fieldKey, opt)}
                              disabled={loading}
                              className="accent-[var(--color-primary)]"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type={field.fieldType === 'number' ? 'number' : 'text'}
                        required={field.isRequired}
                        className="input"
                        value={customFields[field.fieldKey] ?? ''}
                        onChange={e => handleCustomChange(field.fieldKey, e.target.value)}
                        disabled={loading}
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? 'Registering…' : 'Register for free'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
