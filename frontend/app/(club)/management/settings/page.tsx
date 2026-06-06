'use client'

export const dynamic = 'force-dynamic'

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
  catsNotificationEmail: string
  attendanceLanesLabel: string
  attendanceLanesEnabled: boolean
  clubTimezone: string
  creditPriceAud: string
  welcomeEmailSubject: string
  welcomeEmailBody: string
  trainingMetricsEnabled: boolean
  trainingSetsEnabled: boolean
  trainingVideosEnabled: boolean
}

interface FeatureFlag {
  key: string
  label: string
  platformGranted: boolean
  isEnabled: boolean
}

interface CatsField {
  id: number
  fieldKey: string
  fieldLabel: string
  fieldType: string
  fieldOptions: string | null
  isRequired: boolean
}

interface AlertSettings {
  creditAlertsEnabled: boolean
  creditAlertCooldownEnabled: boolean
  creditAlertCooldownDays: number
}

interface EmailTemplate {
  id: number
  name: string
  subject: string
  body: string
  isDefault: boolean
}

interface CreditAlertRule {
  id: number
  thresholdCredits: number
  emailTemplateId: number
  emailTemplate: EmailTemplate
  isEnabled: boolean
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

const ALERT_PLACEHOLDERS = [
  { tag: '{{first_name}}', desc: "Member's first name" },
  { tag: '{{last_name}}', desc: "Member's last name" },
  { tag: '{{balance}}', desc: 'Current credit balance' },
  { tag: '{{threshold}}', desc: 'Alert threshold number' },
]

const BLANK_TEMPLATE = { name: '', subject: '', body: '', isDefault: false }

export default function SettingsPage() {
  const router = useRouter()

  // ── Main settings ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<ClubSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [features, setFeatures] = useState<FeatureFlag[]>([])
  const [catsFields, setCatsFields] = useState<CatsField[]>([])
  const [newField, setNewField] = useState({ label: '', type: 'text', options: '', required: false })
  const [addingField, setAddingField] = useState(false)
  const [fieldError, setFieldError] = useState('')

  // ── Credit alerts ──────────────────────────────────────────────────────────
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    creditAlertsEnabled: false,
    creditAlertCooldownEnabled: false,
    creditAlertCooldownDays: 7,
  })
  const [savingAlerts, setSavingAlerts] = useState(false)
  const [savedAlerts, setSavedAlerts] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [rules, setRules] = useState<CreditAlertRule[]>([])
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState(BLANK_TEMPLATE)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const [newRule, setNewRule] = useState({ thresholdCredits: 5, emailTemplateId: 0 })
  const [addingRule, setAddingRule] = useState(false)
  const [ruleError, setRuleError] = useState('')

  const [recipients, setRecipients] = useState<{ name: string; email: string }[]>([])
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' })
  const [savingRecipients, setSavingRecipients] = useState(false)
  const [savedRecipients, setSavedRecipients] = useState(false)
  const [recipientError, setRecipientError] = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || user.role !== 'webmaster') { router.replace('/dashboard'); return }

    api.get<ClubSettings>('/settings/club')
      .then(data => { setForm(data); setLogoPreview(data.logoUrl) })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))

    api.get<FeatureFlag[]>('/settings/features').then(setFeatures).catch(() => { })
    api.get<CatsField[]>('/settings/cats-fields').then(setCatsFields).catch(() => { })

    // Alert data
    api.get<AlertSettings>('/settings/email-alerts/settings').then(setAlertSettings).catch(() => { })
    api.get<EmailTemplate[]>('/settings/email-alerts/templates').then(setTemplates).catch(() => { })
    api.get<CreditAlertRule[]>('/settings/email-alerts/rules').then(data => {
      setRules(data)
      if (data.length === 0) setNewRule({ thresholdCredits: 5, emailTemplateId: 0 })
    }).catch(() => { })
    api.get<{ name: string; email: string }[]>('/settings/report-recipients')
      .then(data => setRecipients(data))
      .catch(() => { })
  }, [router])

  // ── Main settings handlers ─────────────────────────────────────────────────
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

  async function handleFeatureToggle(key: string, enabled: boolean) {
    try {
      await api.put(`/settings/features/${key}`, enabled)
      setFeatures(prev => prev.map(f => f.key === key ? { ...f, isEnabled: enabled } : f))
      router.refresh()
    } catch {
      setError('Failed to update feature')
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await api.post<{ logoUrl: string }>('/settings/logo', {
        fileName: file.name, contentType: file.type, data: base64,
      })
      setLogoPreview(result.logoUrl)
      update('logoUrl', result.logoUrl)
    } catch {
      setError('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleAddField() {
    if (!newField.label.trim()) { setFieldError('Question text is required'); return }
    if (newField.type === 'select' && !newField.options.trim()) {
      setFieldError('Options are required for dropdown fields'); return
    }
    setAddingField(true); setFieldError('')
    try {
      const created = await api.post<CatsField>('/settings/cats-fields', {
        fieldLabel: newField.label, fieldType: newField.type,
        fieldOptions: newField.type === 'select' ? newField.options : null,
        isRequired: newField.required,
      })
      setCatsFields(p => [...p, created])
      setNewField({ label: '', type: 'text', options: '', required: false })
    } catch { setFieldError('Failed to add question') }
    finally { setAddingField(false) }
  }

  async function handleDeleteField(id: number) {
    await api.delete(`/settings/cats-fields/${id}`)
    setCatsFields(p => p.filter(f => f.id !== id))
  }

  // ── Alert settings handlers ────────────────────────────────────────────────
  async function handleSaveAlerts() {
    setSavingAlerts(true); setSavedAlerts(false)
    try {
      await api.put('/settings/email-alerts/settings', alertSettings)
      setSavedAlerts(true)
      setTimeout(() => setSavedAlerts(false), 3000)
    } catch {
      setError('Failed to save alert settings')
    } finally {
      setSavingAlerts(false)
    }
  }

  function openAddTemplate() {
    setEditingTemplate(null)
    setTemplateForm(BLANK_TEMPLATE)
    setTemplateError('')
    setShowTemplateForm(true)
  }

  function openEditTemplate(t: EmailTemplate) {
    setEditingTemplate(t)
    setTemplateForm({ name: t.name, subject: t.subject, body: t.body, isDefault: t.isDefault })
    setTemplateError('')
    setShowTemplateForm(true)
  }

  function cancelTemplateForm() {
    setShowTemplateForm(false)
    setEditingTemplate(null)
    setTemplateForm(BLANK_TEMPLATE)
  }

  async function handleSaveTemplate() {
    if (!templateForm.name.trim()) { setTemplateError('Name is required'); return }
    if (!templateForm.subject.trim()) { setTemplateError('Subject is required'); return }
    if (!templateForm.body.trim()) { setTemplateError('Body is required'); return }
    setSavingTemplate(true); setTemplateError('')
    try {
      if (editingTemplate) {
        const updated = await api.put<EmailTemplate>(
          `/settings/email-alerts/templates/${editingTemplate.id}`, templateForm)
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
      } else {
        const created = await api.post<EmailTemplate>('/settings/email-alerts/templates', templateForm)
        setTemplates(prev => [...prev, created])
        // Pre-select in new rule if first template
        if (templates.length === 0) setNewRule(r => ({ ...r, emailTemplateId: created.id }))
      }
      cancelTemplateForm()
    } catch {
      setTemplateError('Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleDeleteTemplate(id: number) {
    try {
      await api.delete(`/settings/email-alerts/templates/${id}`)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('in use') ? 'This template is used by an alert rule — remove the rule first.' : 'Failed to delete template')
    }
  }

  async function handleAddRule() {
    if (!newRule.emailTemplateId) { setRuleError('Select an email template'); return }
    setAddingRule(true); setRuleError('')
    try {
      const created = await api.post<CreditAlertRule>('/settings/email-alerts/rules', {
        thresholdCredits: newRule.thresholdCredits,
        emailTemplateId: newRule.emailTemplateId,
        isEnabled: true,
      })
      setRules(prev => [...prev, created])
      setNewRule({ thresholdCredits: 5, emailTemplateId: newRule.emailTemplateId })
    } catch {
      setRuleError('Failed to add rule')
    } finally {
      setAddingRule(false)
    }
  }

  async function handleDeleteRule(id: number) {
    try {
      await api.delete(`/settings/email-alerts/rules/${id}`)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch {
      setError('Failed to delete rule')
    }
  }

  async function handleSaveRecipients() {
    setSavingRecipients(true); setSavedRecipients(false)
    try {
      await api.put('/settings/report-recipients', recipients)
      setSavedRecipients(true)
      setTimeout(() => setSavedRecipients(false), 3000)
    } catch { setRecipientError('Failed to save recipients') }
    finally { setSavingRecipients(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
        <button onClick={handleSave} disabled={saving} className="btn-primary px-6 py-2">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Jump nav */}
      <div className="flex gap-4 text-xs text-gray-400 border-b border-gray-100 pb-3 -mt-2">
        {[
          { label: 'General', href: '#general' },
          { label: 'CATS & Membership', href: '#cats' },
          { label: 'Attendance', href: '#attendance' },
          { label: 'Features', href: '#features' },
          { label: 'Email & Notifications', href: '#email' },
          { label: 'Report Recipients', href: '#recipients' },
        ].map(item => (
          <a key={item.href} href={item.href} className="hover:text-gray-700 transition-colors">
            {item.label}
          </a>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Club Identity ──────────────────────────────────────────────────── */}
      <SectionHeading title="General" id="general" />
      <SettingsCard title="Club Identity" icon="🏛">
        <div className="space-y-5">
          <Field label="Display Name" hint="Shown in the nav bar and throughout the portal">
            <input type="text" className="input" value={form.displayName}
              onChange={e => update('displayName', e.target.value)} />
          </Field>

          <Field label="Club Logo" hint="PNG, JPG, SVG or WebP — shown on the CATS signup form and header">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  : <span className="text-gray-400 text-xs text-center px-1">No logo</span>}
              </div>
              <div>
                <label className="btn-secondary text-sm px-4 py-2 cursor-pointer">
                  {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                  <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp"
                    className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                </label>
                {logoPreview && <p className="text-xs text-gray-400 mt-1">Current logo active</p>}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary Colour" hint="Buttons, active states, header">
              <div className="flex items-center gap-3">
                <input type="color" className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} />
                <input type="text" className="input flex-1 font-mono text-sm"
                  value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} />
              </div>
            </Field>
            <Field label="Secondary Colour" hint="Accents, hover states">
              <div className="flex items-center gap-3">
                <input type="color" className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  value={form.secondaryColor} onChange={e => update('secondaryColor', e.target.value)} />
                <input type="text" className="input flex-1 font-mono text-sm"
                  value={form.secondaryColor} onChange={e => update('secondaryColor', e.target.value)} />
              </div>
            </Field>
          </div>
        </div>
      </SettingsCard>

      {/* ── Regional ──────────────────────────────────────────────────────── */}
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

      {/* ── Membership ────────────────────────────────────────────────────── */}
      <SectionHeading title="CATS & Membership" id="cats" />
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
            <textarea className="input resize-none" rows={2} value={form.catsDescription}
              onChange={e => update('catsDescription', e.target.value)} />
          </Field>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              CATS Notification Email
            </label>
            <p className="text-xs text-gray-600 mb-1">
              Who gets notified when a new CATS member signs up. Separate multiple addresses with a comma.
            </p>
            <input value={form.catsNotificationEmail}
              onChange={e => update('catsNotificationEmail', e.target.value)}
              placeholder="membership@yourclub.com, captain@yourclub.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
        </div>
      </SettingsCard>

      {/* ── CATS Custom Questions ──────────────────────────────────────────── */}
      <SettingsCard title="CATS Sign-Up Questions" icon="❓">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Add extra questions to the public sign-up form. Answers are emailed to your
            notification address — not stored in the database.
          </p>
          {catsFields.length > 0 && (
            <div className="space-y-2">
              {catsFields.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.fieldLabel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {f.fieldType === 'select' ? `Dropdown: ${f.fieldOptions}` : f.fieldType}
                      {f.isRequired && <span className="ml-2 text-red-400">Required</span>}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteField(f.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}
          {catsFields.length === 0 && (
            <p className="text-sm text-gray-400 italic">No custom questions yet.</p>
          )}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add a Question</p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Question Text</label>
              <input type="text" value={newField.label}
                onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                placeholder="Have you swum competitively before?" className="input w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Answer Type</label>
                <select value={newField.type}
                  onChange={e => setNewField(p => ({ ...p, type: e.target.value }))} className="input w-full">
                  <option value="text">Free text</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Yes / No</option>
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newField.required}
                    onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))}
                    className="rounded border-gray-300" />
                  <span className="text-sm text-gray-600">Required</span>
                </label>
              </div>
            </div>
            {newField.type === 'select' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Options <span className="text-gray-400">(comma-separated)</span>
                </label>
                <input type="text" value={newField.options}
                  onChange={e => setNewField(p => ({ ...p, options: e.target.value }))}
                  placeholder="Yes, No, Sometimes" className="input w-full" />
              </div>
            )}
            {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
            <button onClick={handleAddField} disabled={addingField} className="btn-primary text-sm px-4 py-2">
              {addingField ? 'Adding…' : '+ Add Question'}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* ── Attendance ────────────────────────────────────────────────────── */}
      <SectionHeading title="Attendance" id="attendance" />
      <SettingsCard title="Attendance" icon="✓">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Track Lanes Used</p>
              <p className="text-xs text-gray-400 mt-0.5">Enables the lanes input on the attendance sheet</p>
            </div>
            <Toggle
              checked={form.attendanceLanesEnabled}
              onChange={v => update('attendanceLanesEnabled', v)} />
          </div>
          {form.attendanceLanesEnabled && (
            <Field label="Lanes Field Label"
              hint="What the lanes tracking field is called on the attendance sheet">
              <input type="text" className="input w-48" value={form.attendanceLanesLabel}
                onChange={e => update('attendanceLanesLabel', e.target.value)} />
            </Field>
          )}
        </div>
      </SettingsCard>

      <SectionHeading title="Report Recipients" id="recipients" />
      <SettingsCard title="Attendance Report Recipients" icon="📧">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Saved contacts appear as checkboxes when sending an attendance report — no need to type the email each time.
          </p>

          {recipients.length > 0 && (
            <div className="space-y-2">
              {recipients.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </div>
                  <button
                    onClick={() => setRecipients(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none">×
                  </button>
                </div>
              ))}
            </div>
          )}

          {recipients.length === 0 && (
            <p className="text-sm text-gray-400 italic">No saved recipients yet.</p>
          )}

          <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add Recipient</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input type="text" className="input" placeholder="e.g. President"
                  value={newRecipient.name}
                  onChange={e => setNewRecipient(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input type="email" className="input" placeholder="president@bsm.com"
                  value={newRecipient.email}
                  onChange={e => setNewRecipient(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            {recipientError && <p className="text-xs text-red-500">{recipientError}</p>}
            <button
              onClick={() => {
                if (!newRecipient.name.trim() || !newRecipient.email.trim()) {
                  setRecipientError('Both name and email are required'); return
                }
                setRecipientError('')
                setRecipients(prev => [...prev, { name: newRecipient.name.trim(), email: newRecipient.email.trim() }])
                setNewRecipient({ name: '', email: '' })
              }}
              className="btn-primary text-sm px-4 py-2">
              + Add
            </button>
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button onClick={handleSaveRecipients} disabled={savingRecipients} className="btn-primary px-6 py-2">
              {savingRecipients ? 'Saving…' : savedRecipients ? '✓ Saved' : 'Save Recipients'}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <SectionHeading title="Features" id="features" />
      <SettingsCard title="Features" icon="⚙️">
        {features.map(f => (
          <div key={f.key}>
            <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1">
                <p className={`text-sm font-medium ${!f.platformGranted ? 'text-gray-400' : 'text-gray-700'}`}>
                  {f.label}
                  {!f.platformGranted && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                      Not available on your plan
                    </span>
                  )}
                </p>
              </div>
              <Toggle
                checked={f.isEnabled}
                disabled={!f.platformGranted}
                onChange={v => f.platformGranted && handleFeatureToggle(f.key, v)} />
            </div>
            {f.key === 'training' && f.isEnabled && f.platformGranted && form && (
              <div className="ml-4 mt-2 mb-3 pl-4 border-l-2 border-gray-100 space-y-2">
                {[
                  { key: 'trainingMetricsEnabled' as keyof ClubSettings, label: 'Personal Bests', desc: 'Member performance tracking' },
                  { key: 'trainingSetsEnabled' as keyof ClubSettings, label: 'Training Sets', desc: 'Swim sets library and set of the week' },
                  { key: 'trainingVideosEnabled' as keyof ClubSettings, label: 'Training Videos', desc: 'YouTube video library' },
                ].map(sub => (
                  <div key={sub.key} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm text-gray-600">{sub.label}</p>
                      <p className="text-xs text-gray-400">{sub.desc}</p>
                    </div>
                    <Toggle
                      size="sm"
                      checked={!!form[sub.key]}
                      onChange={v => update(sub.key, v as ClubSettings[typeof sub.key])} />
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-1">Sub-feature changes save with "Save Changes"</p>
              </div>
            )}
          </div>
        ))}
      </SettingsCard>

      {/* ── Email & Notifications ──────────────────────────────────────────── */}
      <SectionHeading title="Email & Notifications" id="email" />

      {/* Welcome Email */}
      <SettingsCard title="Welcome Email" icon="✉️">
        <div className="space-y-5">
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

      {/* Credit Alerts */}
      <SettingsCard title="Credit Alerts" icon="🔔">
        <div className="space-y-6">

          {/* Master toggle + save */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enable Credit Alerts</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Automatically email members when their credit balance drops to a set threshold
              </p>
            </div>
            <Toggle
              checked={alertSettings.creditAlertsEnabled}
              onChange={v => setAlertSettings(s => ({ ...s, creditAlertsEnabled: v }))} />
          </div>

          {alertSettings.creditAlertsEnabled && (
            <>
              {/* Cooldown */}
              <div className="border-t border-gray-100 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Alert Cooldown</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Prevent the same alert firing again within a set number of days
                    </p>
                  </div>
                  <Toggle
                    checked={alertSettings.creditAlertCooldownEnabled}
                    onChange={v => setAlertSettings(s => ({ ...s, creditAlertCooldownEnabled: v }))} />
                </div>
                {alertSettings.creditAlertCooldownEnabled && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 whitespace-nowrap">
                      Don&apos;t re-alert within
                    </label>
                    <input
                      type="number" min={1} max={90}
                      className="input w-20 text-center"
                      value={alertSettings.creditAlertCooldownDays}
                      onChange={e => setAlertSettings(s => ({
                        ...s, creditAlertCooldownDays: parseInt(e.target.value) || 7
                      }))} />
                    <span className="text-sm text-gray-600">days</span>
                  </div>
                )}
              </div>

              {/* Alert Rules */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Alert Rules
                </p>
                <p className="text-xs text-gray-400">
                  Each rule fires when a member&apos;s balance drops to or below the threshold.
                </p>

                {rules.length > 0 && (
                  <div className="space-y-2">
                    {rules.sort((a, b) => a.thresholdCredits - b.thresholdCredits).map(rule => (
                      <div key={rule.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div className="text-sm text-gray-700">
                          When credits reach{' '}
                          <span className="font-semibold text-[var(--color-primary)]">
                            {rule.thresholdCredits}
                          </span>
                          {' '}→ send{' '}
                          <span className="font-medium">{rule.emailTemplate.name}</span>
                          {rule.emailTemplate.isDefault && (
                            <span className="ml-2 text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteRule(rule.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none ml-4">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add rule row */}
                <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-medium text-gray-500">Add Alert Rule</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-600 whitespace-nowrap">When credits reach</span>
                    <input
                      type="number" min={1}
                      className="input w-20 text-center"
                      value={newRule.thresholdCredits}
                      onChange={e => setNewRule(r => ({ ...r, thresholdCredits: parseInt(e.target.value) || 1 }))} />
                    <span className="text-sm text-gray-600">→ send</span>
                    <select
                      className="input flex-1 min-w-40"
                      value={newRule.emailTemplateId || ''}
                      onChange={e => setNewRule(r => ({ ...r, emailTemplateId: parseInt(e.target.value) }))}>
                      <option value="">Select email…</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.isDefault ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddRule}
                      disabled={addingRule || templates.length === 0}
                      className="btn-primary text-sm px-4 py-2 whitespace-nowrap">
                      {addingRule ? 'Adding…' : '+ Add'}
                    </button>
                  </div>
                  {templates.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Add an email template below before creating rules.
                    </p>
                  )}
                  {ruleError && <p className="text-xs text-red-500">{ruleError}</p>}
                </div>
              </div>

              {/* Email Templates */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Email Templates
                  </p>
                  {!showTemplateForm && (
                    <button onClick={openAddTemplate}
                      className="text-xs text-[var(--color-primary)] hover:underline font-medium">
                      + Add Template
                    </button>
                  )}
                </div>

                {templates.length > 0 && (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <div key={t.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{t.name}</span>
                          {t.isDefault && (
                            <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                              ★ Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditTemplate(t)}
                            className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                            Edit
                          </button>
                          <button onClick={() => handleDeleteTemplate(t.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {templates.length === 0 && !showTemplateForm && (
                  <p className="text-sm text-gray-400 italic">No email templates yet. Add one to get started.</p>
                )}

                {/* Template form */}
                {showTemplateForm && (
                  <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {editingTemplate ? `Edit: ${editingTemplate.name}` : 'New Email Template'}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Template Name" hint="Internal name, e.g. 'Low Credits Warning'">
                        <input type="text" className="input"
                          value={templateForm.name}
                          onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} />
                      </Field>
                      <Field label="Subject Line">
                        <input type="text" className="input"
                          value={templateForm.subject}
                          onChange={e => setTemplateForm(f => ({ ...f, subject: e.target.value }))} />
                      </Field>
                    </div>

                    <Field label="Email Body">
                      <textarea className="input resize-none font-mono text-sm" rows={6}
                        value={templateForm.body}
                        onChange={e => setTemplateForm(f => ({ ...f, body: e.target.value }))} />
                    </Field>

                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Available placeholders:</p>
                      <div className="grid grid-cols-2 gap-1">
                        {ALERT_PLACEHOLDERS.map(p => (
                          <div key={p.tag} className="flex items-center gap-2 text-xs">
                            <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-blue-600">
                              {p.tag}
                            </code>
                            <span className="text-gray-400">{p.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox"
                          checked={templateForm.isDefault}
                          onChange={e => setTemplateForm(f => ({ ...f, isDefault: e.target.checked }))}
                          className="rounded border-gray-300" />
                        <span className="text-sm text-gray-600">Set as default template</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button onClick={cancelTemplateForm}
                          className="btn-secondary text-sm px-4 py-2">Cancel</button>
                        <button onClick={handleSaveTemplate} disabled={savingTemplate}
                          className="btn-primary text-sm px-4 py-2">
                          {savingTemplate ? 'Saving…' : editingTemplate ? 'Update Template' : 'Save Template'}
                        </button>
                      </div>
                    </div>
                    {templateError && <p className="text-xs text-red-500">{templateError}</p>}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Save alert settings */}
          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <button onClick={handleSaveAlerts} disabled={savingAlerts} className="btn-primary px-6 py-2">
              {savingAlerts ? 'Saving…' : savedAlerts ? '✓ Saved' : 'Save Alert Settings'}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-2.5">
          {saving ? 'Saving…' : saved ? '✓ All Changes Saved' : 'Save Changes'}
        </button>
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false, size = 'md' }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const thumb = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const on = size === 'sm' ? 'translate-x-5' : 'translate-x-6'
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex ${track} items-center rounded-full transition-colors ${disabled ? 'bg-gray-100 cursor-not-allowed'
        : checked ? 'bg-[var(--color-primary)]' : 'bg-gray-200'
        }`}>
      <span className={`inline-block ${thumb} transform rounded-full bg-white transition-transform ${checked ? on : 'translate-x-1'
        }`} />
    </button>
  )
}

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

function SectionHeading({ title, id }: { title: string; id?: string }) {
  return (
    <div id={id} className="flex items-center gap-3 pt-2 scroll-mt-20">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
        {title}
      </h2>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}