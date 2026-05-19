'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

interface ClubSettings {
  displayName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  associationNumberLabel: string
  catsInitialCredits: number
  catsDescription: string
  attendanceLanesLabel: string
  attendanceLanesEnabled: boolean
  clubTimezone: string
  creditPriceAud: string
  welcomeEmailSubject: string
  welcomeEmailBody: string
}

const TIMEZONES = [
  { label: 'Brisbane (UTC+10, no DST)', value: 'Australia/Brisbane' },
  { label: 'Sydney / Melbourne (AEDT)', value: 'Australia/Sydney' },
  { label: 'Adelaide (ACST/ACDT)', value: 'Australia/Adelaide' },
  { label: 'Perth (AWST)', value: 'Australia/Perth' },
  { label: 'Darwin (ACST)', value: 'Australia/Darwin' },
  { label: 'Hobart (AEST/AEDT)', value: 'Australia/Hobart' },
  { label: 'Auckland (NZST/NZDT)', value: 'Pacific/Auckland' },
  { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'New York (EST/EDT)', value: 'America/New_York' },
]

const EMAIL_PLACEHOLDERS = [
  { tag: '{{firstName}}', desc: "Member's first name" },
  { tag: '{{clubName}}', desc: 'Club display name' },
  { tag: '{{email}}', desc: "Member's email address" },
  { tag: '{{password}}', desc: 'Generated password' },
  { tag: '{{portalUrl}}', desc: 'URL to the member portal' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<ClubSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || user.role !== 'webmaster') { router.replace('/dashboard'); return }
    api.get<ClubSettings>('/settings/club')
      .then(data => { setForm(data); setLogoPreview(data.logoUrl) })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [router])

  function update<K extends keyof ClubSettings>(key: K, value: ClubSettings[K]) {
    setForm(f => f ? { ...f, [key]: value } : f)
  }

  async function handleSave() {
    if (!form) return
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.put('/settings/club', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      // Convert to base64 — avoids multipart proxy issues
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const result = await api.post<{ logoUrl: string }>('/settings/logo', {
        fileName: file.name,
        contentType: file.type,
        data: base64,
      })
      setLogoPreview(result.logoUrl)
      update('logoUrl', result.logoUrl)
    } catch {
      setError('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      {[1, 2, 3, 4].map(i => <div key={i} className="card h-40 animate-pulse bg-gray-100" />)}
    </div>
  )

  if (!form) return null

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Club Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure your club portal — changes take effect immediately
          </p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary px-6 py-2">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Club Identity ───────────────────────────────────────────────── */}
      <SettingsCard title="Club Identity" icon="🏛">
        <div className="space-y-5">
          <Field label="Display Name" hint="Shown in the nav bar and throughout the portal">
            <input type="text" className="input" value={form.displayName}
              onChange={e => update('displayName', e.target.value)} />
          </Field>

          <Field label="Club Logo" hint="PNG, JPG, SVG or WebP — shown on the CATS signup form and header">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-gray-400 text-xs text-center px-1">No logo</span>
                )}
              </div>
              <div>
                <label className="btn-secondary text-sm px-4 py-2 cursor-pointer">
                  {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                  <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp"
                    className="hidden" onChange={handleLogoUpload}
                    disabled={uploadingLogo} />
                </label>
                {logoPreview && (
                  <p className="text-xs text-gray-400 mt-1">Current logo active</p>
                )}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary Colour" hint="Buttons, active states, header">
              <div className="flex items-center gap-3">
                <input type="color" className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  value={form.primaryColor}
                  onChange={e => update('primaryColor', e.target.value)} />
                <input type="text" className="input flex-1 font-mono text-sm"
                  value={form.primaryColor}
                  onChange={e => update('primaryColor', e.target.value)} />
              </div>
            </Field>
            <Field label="Secondary Colour" hint="Accents, hover states">
              <div className="flex items-center gap-3">
                <input type="color" className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  value={form.secondaryColor}
                  onChange={e => update('secondaryColor', e.target.value)} />
                <input type="text" className="input flex-1 font-mono text-sm"
                  value={form.secondaryColor}
                  onChange={e => update('secondaryColor', e.target.value)} />
              </div>
            </Field>
          </div>
        </div>
      </SettingsCard>

      {/* ── Membership ──────────────────────────────────────────────────── */}
      <SettingsCard title="Membership" icon="👥">
        <div className="space-y-5">
          <Field label="Association Number Label"
            hint="The name of the external membership number field. E.g. 'Swimmaster Number', 'Athletics Australia Number'">
            <input type="text" className="input" value={form.associationNumberLabel}
              onChange={e => update('associationNumberLabel', e.target.value)} />
          </Field>

          <Field label="CATS Initial Credits"
            hint="Number of free session credits given to new Come & Try members on signup">
            <input type="number" min="0" max="10" className="input w-32"
              value={form.catsInitialCredits}
              onChange={e => update('catsInitialCredits', parseInt(e.target.value) || 0)} />
          </Field>

          <Field label="CATS Signup Description"
            hint="Shown below the club logo on the public Come & Try signup form">
            <textarea className="input resize-none" rows={2}
              value={form.catsDescription}
              onChange={e => update('catsDescription', e.target.value)} />
          </Field>
        </div>
      </SettingsCard>

      {/* ── Attendance ──────────────────────────────────────────────────── */}
      <SettingsCard title="Attendance" icon="✓">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Track Lanes Used</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Enables the lanes input on the attendance sheet
              </p>
            </div>
            <button
              onClick={() => update('attendanceLanesEnabled', !form.attendanceLanesEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.attendanceLanesEnabled ? 'bg-[var(--color-primary)]' : 'bg-gray-200'
                }`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.attendanceLanesEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
            </button>
          </div>

          {form.attendanceLanesEnabled && (
            <Field label="Lanes Field Label"
              hint="What the lanes tracking field is called on the attendance sheet">
              <input type="text" className="input w-48"
                value={form.attendanceLanesLabel}
                onChange={e => update('attendanceLanesLabel', e.target.value)} />
            </Field>
          )}
        </div>
      </SettingsCard>

      {/* ── Regional ────────────────────────────────────────────────────── */}
      <SettingsCard title="Regional" icon="🌏">
        <Field label="Club Timezone"
          hint="Used for reports and day-of-week calculations. Select the timezone your club operates in.">
          <select className="input" value={form.clubTimezone}
            onChange={e => update('clubTimezone', e.target.value)}>
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </Field>
      </SettingsCard>

      {/* ── Welcome Email ────────────────────────────────────────────────── */}
      <SettingsCard title="Welcome Email" icon="✉️">
        <div className="space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
            📬 Email sending is enabled in Phase 10. Configure the template now and it will be
            ready to send when email is activated.
          </div>

          <Field label="Subject Line">
            <input type="text" className="input" value={form.welcomeEmailSubject}
              onChange={e => update('welcomeEmailSubject', e.target.value)} />
          </Field>

          <Field label="Email Body">
            <textarea className="input resize-none font-mono text-sm" rows={8}
              value={form.welcomeEmailBody}
              onChange={e => update('welcomeEmailBody', e.target.value)} />
          </Field>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Available placeholders:</p>
            <div className="grid grid-cols-2 gap-1">
              {EMAIL_PLACEHOLDERS.map(p => (
                <div key={p.tag} className="flex items-center gap-2 text-xs">
                  <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-600">
                    {p.tag}
                  </code>
                  <span className="text-gray-400">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary px-8 py-2.5">
          {saving ? 'Saving…' : saved ? '✓ All Changes Saved' : 'Save Changes'}
        </button>
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SettingsCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {children}
    </div>
  )
}