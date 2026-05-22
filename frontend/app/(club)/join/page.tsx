'use client'
import { useEffect, useState } from 'react'

interface ClubConfig {
  displayName:     string
  catsDescription: string
}

interface FormField {
  fieldKey:     string
  fieldLabel:   string
  fieldType:    string   // text, select, date, checkbox
  fieldOptions: string | null
  isRequired:   boolean
}

export default function JoinPage() {
  const [config,      setConfig]      = useState<ClubConfig | null>(null)
  const [fields,      setFields]      = useState<FormField[]>([])
  const [step,        setStep]        = useState<'form' | 'success'>('form')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [initialCredits, setInitialCredits] = useState(0)

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    phone: '', password: '', confirmPassword: ''
  })
  const [customFields, setCustomFields] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/public/club-config', { cache: 'no-store' })
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {})

    fetch('/api/public/cats-form-fields', { cache: 'no-store' })
      .then(r => r.json())
      .then(setFields)
      .catch(() => {})
  }, [])

  function update(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
    setError('')
  }

  function updateCustom(key: string, value: string) {
    setCustomFields(p => ({ ...p, [key]: value }))
    setError('')
  }

  function renderField(f: FormField) {
    const options = f.fieldOptions
      ? f.fieldOptions.split(',').map(o => o.trim()).filter(Boolean)
      : []

    const baseClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)]'

    return (
      <div key={f.fieldKey}>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {f.fieldLabel}
          {f.isRequired
            ? <span className="text-red-400 ml-0.5">*</span>
            : <span className="text-gray-400 ml-1">(optional)</span>}
        </label>

        {f.fieldType === 'select' ? (
          <select
            value={customFields[f.fieldKey] ?? ''}
            onChange={e => updateCustom(f.fieldKey, e.target.value)}
            className={baseClass}
          >
            <option value="">Select…</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.fieldType === 'date' ? (
          <input type="date"
            value={customFields[f.fieldKey] ?? ''}
            onChange={e => updateCustom(f.fieldKey, e.target.value)}
            className={baseClass} />
        ) : f.fieldType === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              checked={customFields[f.fieldKey] === 'true'}
              onChange={e => updateCustom(f.fieldKey, e.target.checked ? 'true' : 'false')}
              className="rounded border-gray-300 text-[var(--color-primary,#1a2744)]" />
            <span className="text-sm text-gray-600">{f.fieldLabel}</span>
          </label>
        ) : (
          <input type="text"
            value={customFields[f.fieldKey] ?? ''}
            onChange={e => updateCustom(f.fieldKey, e.target.value)}
            placeholder={f.fieldLabel}
            className={baseClass} />
        )}
      </div>
    )
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError('Please fill in all required fields'); return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match'); return
    }

    // Check required custom fields
    const missingRequired = fields.filter(
      f => f.isRequired && !customFields[f.fieldKey]
    )
    if (missingRequired.length > 0) {
      setError(`Please complete: ${missingRequired.map(f => f.fieldLabel).join(', ')}`)
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/public/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName:    form.firstName,
        lastName:     form.lastName,
        email:        form.email,
        password:     form.password,
        phone:        form.phone || null,
        customFields: Object.keys(customFields).length > 0 ? customFields : null
      })
    })

    const data = await res.json()
    if (res.ok) {
      setInitialCredits(data.initialCredits ?? 0)
      setStep('success')
    } else {
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // ── Success ─────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[var(--color-bg,#f3f4f6)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to {config?.displayName}!
          </h1>
          <p className="text-gray-500 mb-2">Your account has been created successfully.</p>
          {initialCredits > 0 && (
            <p className="text-sm text-[var(--color-primary,#1a2744)] font-medium mb-6">
              🎉 You've been given {initialCredits} credit{initialCredits !== 1 ? 's' : ''} to get started.
            </p>
          )}
          <a href="/login"
            className="block w-full bg-[var(--color-primary,#1a2744)] text-white rounded-xl py-3 font-semibold hover:opacity-90 transition-opacity">
            Sign in to your account
          </a>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg,#f3f4f6)] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
            {config?.displayName ?? ''}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          {config?.catsDescription && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {config.catsDescription}
            </p>
          )}
        </div>

        {/* Form body */}
        <div className="px-8 py-6 space-y-4">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'First Name', field: 'firstName', placeholder: 'Alex' },
              { label: 'Last Name',  field: 'lastName',  placeholder: 'Morgan' },
            ].map(f => (
              <div key={f.field}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {f.label} <span className="text-red-400">*</span>
                </label>
                <input type="text"
                  placeholder={f.placeholder}
                  value={(form as any)[f.field]}
                  onChange={e => update(f.field, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)]" />
              </div>
            ))}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input type="email"
              placeholder="alex@example.com"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)]" />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Phone <span className="text-gray-400">(optional)</span>
            </label>
            <input type="tel"
              placeholder="04xx xxx xxx"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)]" />
          </div>

          {/* Dynamic custom fields */}
          {fields.map(f => renderField(f))}

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Password <span className="text-red-400">*</span>
            </label>
            <input type="password"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)]" />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <input type="password"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={e => update('confirmPassword', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1a2744)] ${
                form.confirmPassword && form.password !== form.confirmPassword
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200'
              }`} />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[var(--color-primary,#1a2744)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-[var(--color-primary,#1a2744)] font-medium hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}