'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const dark   = '#0a0a0f'
const card   = '#0a0f1a'
const navy   = '#1a56db'
const muted  = '#94a3b8'
const border = '#0f1f35'

const SPORT_TYPES = [
  'Swimming', 'Rowing', 'Athletics', 'Cycling', 'Triathlon',
  'Tennis', 'Basketball', 'Football', 'Rugby', 'Other'
]

const FEATURE_LABELS: Record<string, string> = {
  calendar: 'Session Calendar & Booking',
  my_sessions: 'My Sessions & History',
  attendance: 'Attendance Tracking & QR Check-in',
  shop: 'Club Shop & Credit System',
  my_account: 'Member Portal & Management',
  training: 'Training & Personal Bests',
  reports: 'Reports & CSV Export',
  news: 'Club News & Updates',
}

interface PackageOption {
  id: number
  name: string
  price: number
  memberCap: number
  featureKeys: string[]
}

interface FormData {
  // Step 1
  clubName: string
  displayName: string
  sportType: string
  estimatedMembers: string
  website: string
  // Step 2
  contactName: string
  contactEmail: string
  contactPhone: string
  // Step 3
  packageId: number | null
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [packages, setPackages] = useState<PackageOption[]>([])
  const [form, setForm] = useState<FormData>({
    clubName: '', displayName: '', sportType: 'Swimming',
    estimatedMembers: '', website: '',
    contactName: '', contactEmail: '', contactPhone: '',
    packageId: null,
  })
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentData, setIntentData] = useState<{ packageName: string; monthlyPrice: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/register/packages')
      .then(r => r.json())
      .then(data => {
        setPackages(data)
        const planParam = searchParams.get('plan')
        if (planParam) {
          const pkg = data.find((p: PackageOption) => p.id === parseInt(planParam))
          if (pkg) setForm(f => ({ ...f, packageId: pkg.id }))
        }
      })
      .catch(() => {})
  }, [searchParams])

  function update(key: keyof FormData, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function validateStep(): string {
    if (step === 1) {
      if (!form.clubName.trim()) return 'Club name is required'
      if (!form.displayName.trim()) return 'Portal name is required'
      if (!form.sportType) return 'Sport type is required'
    }
    if (step === 2) {
      if (!form.contactName.trim()) return 'Your name is required'
      if (!form.contactEmail.trim()) return 'Email is required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) return 'Valid email required'
    }
    if (step === 3) {
      if (!form.packageId) return 'Please select a package'
    }
    return ''
  }

  async function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')

    if (step === 3) {
      // Create payment intent
      setLoading(true)
      try {
        const res = await fetch('/api/register/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clubName:         form.clubName,
            displayName:      form.displayName,
            sportType:        form.sportType,
            estimatedMembers: form.estimatedMembers ? parseInt(form.estimatedMembers) : null,
            website:          form.website || null,
            contactName:      form.contactName,
            contactEmail:     form.contactEmail,
            contactPhone:     form.contactPhone || null,
            packageId:        form.packageId,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create payment')
        setClientSecret(data.clientSecret)
        setIntentData({ packageName: data.packageName, monthlyPrice: data.monthlyPrice })
        setStep(4)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
      return
    }

    setStep(s => s + 1)
  }

  const selectedPackage = packages.find(p => p.id === form.packageId)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem',
    background: '#060a10', border: `1px solid ${border}`,
    color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', color: muted,
    marginBottom: '0.4rem', letterSpacing: '0.05em',
  }

  return (
    <div style={{ background: dark, minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 2.5rem', background: 'rgba(10,10,15,0.95)',
        borderBottom: `1px solid ${border}`,
      }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fff', fontWeight: 600 }}>
            Members <span style={{ color: '#d97706' }}>Guild</span>
          </span>
        </a>
        <a href="/" style={{ fontSize: '0.8rem', color: muted, textDecoration: 'none' }}>← Back to home</a>
      </nav>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4rem 2rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '0.75rem' }}>
            Register Your Club
          </p>
          <h1 style={{ fontSize: '2rem', fontWeight: 300, color: '#fff', margin: '0 0 0.5rem' }}>
            Let's get your club live.
          </h1>
          <p style={{ color: muted, fontSize: '0.9rem' }}>
            $199 setup fee · First month included · Live within 24 hours
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2.5rem' }}>
          {['Club Details', 'Your Details', 'Package', 'Payment'].map((label, i) => {
            const num = i + 1
            const active = num === step
            const done = num < step
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{
                    width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700,
                    background: done ? navy : active ? navy : 'transparent',
                    border: `1px solid ${done || active ? navy : border}`,
                    color: done || active ? '#fff' : muted,
                  }}>
                    {done ? '✓' : num}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: active ? '#fff' : muted, display: 'none' }}>
                    {label}
                  </span>
                </div>
                {i < 3 && <div style={{ width: '2rem', height: '1px', background: border }} />}
              </div>
            )
          })}
        </div>

        {/* Form card */}
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '1rem', padding: '2rem' }}>

          {/* Step label */}
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: navy, marginBottom: '1.5rem' }}>
            Step {step} — {['Club Details', 'Your Details', 'Choose Package', 'Payment'][step - 1]}
          </p>

          {error && (
            <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* ── Step 1: Club Details ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Club Name *</label>
                <input style={inputStyle} value={form.clubName} placeholder="Brisbane Southside Masters Swimming"
                  onChange={e => update('clubName', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Portal Name *</label>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>
                  Short name shown in your portal nav. E.g. "BSM Swimming"
                </p>
                <input style={inputStyle} value={form.displayName} placeholder="BSM Swimming"
                  onChange={e => update('displayName', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Sport Type *</label>
                  <select style={{ ...inputStyle }}
                    value={form.sportType} onChange={e => update('sportType', e.target.value)}>
                    {SPORT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estimated Members</label>
                  <input style={inputStyle} type="number" value={form.estimatedMembers} placeholder="60"
                    onChange={e => update('estimatedMembers', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Website (optional)</label>
                <input style={inputStyle} value={form.website} placeholder="https://yourclub.com.au"
                  onChange={e => update('website', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Step 2: Your Details ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.875rem', color: muted, margin: 0 }}>
                You'll be the portal administrator. You can add other staff after setup.
              </p>
              <div>
                <label style={labelStyle}>Your Full Name *</label>
                <input style={inputStyle} value={form.contactName} placeholder="Alex Morgan"
                  onChange={e => update('contactName', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input style={inputStyle} type="email" value={form.contactEmail} placeholder="alex@yourclub.com.au"
                  onChange={e => update('contactEmail', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} type="tel" value={form.contactPhone} placeholder="0412 345 678"
                  onChange={e => update('contactPhone', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Step 3: Choose Package ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {packages.map(pkg => (
                <div key={pkg.id}
                  onClick={() => update('packageId', pkg.id)}
                  style={{
                    border: `1px solid ${form.packageId === pkg.id ? navy : border}`,
                    borderRadius: '0.75rem', padding: '1.25rem', cursor: 'pointer',
                    background: form.packageId === pkg.id ? '#060d1f' : dark,
                    transition: 'border-color 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: 0 }}>{pkg.name}</p>
                        {pkg.id === 2 && (
                          <span style={{ fontSize: '0.65rem', background: navy, color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '9999px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Popular
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: muted, margin: '0.2rem 0 0' }}>
                        Up to {pkg.memberCap} members
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: form.packageId === pkg.id ? '#60a5fa' : '#fff' }}>
                        ${pkg.price}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: muted }}>/mo</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {pkg.featureKeys.map(key => (
                      <span key={key} style={{ fontSize: '0.72rem', color: muted, background: '#0a1020', border: `1px solid ${border}`, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                        {FEATURE_LABELS[key] ?? key}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p style={{ fontSize: '0.8rem', color: '#334155', textAlign: 'center', marginTop: '0.5rem' }}>
                $199 setup fee includes your first month · No lock-in contracts
              </p>
            </div>
          )}

          {/* ── Step 4: Payment ── */}
          {step === 4 && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: navy } } }}>
              <PaymentStep
                clientSecret={clientSecret}
                packageName={intentData?.packageName ?? ''}
                monthlyPrice={intentData?.monthlyPrice ?? 0}
                contactEmail={form.contactEmail}
              />
            </Elements>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: `1px solid ${border}` }}>
              {step > 1 ? (
                <button onClick={() => { setStep(s => s - 1); setError('') }}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', fontSize: '0.875rem' }}>
                  ← Back
                </button>
              ) : <div />}
              <button onClick={handleNext} disabled={loading}
                style={{ padding: '0.75rem 2rem', borderRadius: '0.5rem', background: navy, color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Setting up…' : step === 3 ? 'Proceed to Payment →' : 'Continue →'}
              </button>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#334155' }}>
          Questions? Email{' '}
          <a href="mailto:hello@membersguild.com.au" style={{ color: '#60a5fa', textDecoration: 'none' }}>
            hello@membersguild.com.au
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Stripe payment step ──────────────────────────────────────────────────────
function PaymentStep({ clientSecret, packageName, monthlyPrice, contactEmail }: {
  clientSecret: string
  packageName: string
  monthlyPrice: number
  contactEmail: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    if (!stripe || !elements) return
    setPaying(true)
    setError('')

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/register/success`,
        receipt_email: contactEmail,
      },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed — please try again.')
      setPaying(false)
    }
    // On success Stripe redirects to /register/success
  }

  const navy = '#1a56db'
  const border = '#0f1f35'
  const muted = '#94a3b8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Order summary */}
      <div style={{ background: '#060a10', border: `1px solid ${border}`, borderRadius: '0.75rem', padding: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: muted, marginBottom: '1rem' }}>
          Order Summary
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.875rem', color: muted }}>Setup fee (includes first month)</span>
          <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>$199.00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: `1px solid ${border}` }}>
          <span style={{ fontSize: '0.8rem', color: '#475569' }}>Then from month 2</span>
          <span style={{ fontSize: '0.8rem', color: '#475569' }}>${monthlyPrice}/month · {packageName}</span>
        </div>
      </div>

      {/* Stripe Elements */}
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <button onClick={handlePay} disabled={!stripe || paying}
        style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', background: navy, color: '#fff', border: 'none', cursor: paying ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.05em', opacity: paying ? 0.7 : 1 }}>
        {paying ? 'Processing…' : 'Pay $199 & Register Club →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#334155' }}>
        🔒 Secured by Stripe · Your card details are never stored by MembersGuild
      </p>
    </div>
  )
}

// ── Page export with Suspense ─────────────────────────────────────────────────
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}