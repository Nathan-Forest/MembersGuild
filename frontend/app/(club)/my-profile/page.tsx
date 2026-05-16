'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { Member } from '@/types'
import { ROLE_LABELS } from '@/types'

export default function MyProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }

    api.get<Member>(`/members/${user.sub}`)
      .then(data => {
        setProfile(data)
        setForm({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? '',
          emergencyContactName: data.emergencyContactName ?? '',
          emergencyContactPhone: data.emergencyContactPhone ?? '',
        })
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await api.put<Member>(`/members/${profile!.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || null,
        memberNumber: profile!.memberNumber,
        dateOfBirth: profile!.dateOfBirth,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
      })
      setProfile(updated)
      setEditing(false)
      setSuccess('Profile updated successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordSuccess('Password changed successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">My Profile</h1>
      <div className="animate-pulse space-y-4">
        <div className="h-48 rounded-xl bg-gray-200" />
        <div className="h-64 rounded-xl bg-gray-200" />
        <div className="h-64 rounded-xl bg-gray-200" />
      </div>
    </div>
  )

  if (!profile) return null

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`
  const memberSince = new Date(profile.effectiveJoinDate ?? profile.createdAt).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric'
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <h1 className="page-title">My Profile</h1>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-primary px-4 py-2">
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          ✓ {success}
        </div>
      )}

      {/* ── Identity card ───────────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Coloured header band */}
        <div className="h-24 w-full" style={{ backgroundColor: 'var(--color-primary)' }} />

        {/* Avatar overlapping the band */}
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div
              className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center text-white text-2xl font-bold shadow-md"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              {initials}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-blue">{ROLE_LABELS[profile.role]}</span>
              {profile.memberNumber && (
                <span className="badge badge-gray">#{profile.memberNumber}</span>
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {profile.firstName} {profile.lastName}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Member since {memberSince}</p>
        </div>
      </div>

      {/* ── Personal details ─────────────────────────────────────────── */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Personal Details
        </h3>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name</label>
                <input type="text" required className="input"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="label">Last name</label>
                <input type="text" required className="input"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="label">Phone</label>
              <input type="tel" className="input"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-600 mb-3">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input type="text" className="input"
                    value={form.emergencyContactName}
                    onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" className="input"
                    value={form.emergencyContactPhone}
                    onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary px-6 py-2">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-0 divide-y divide-gray-100">
            <DetailRow label="Email"        value={profile.email} />
            <DetailRow label="Phone"        value={profile.phone ?? '—'} />
            {profile.dateOfBirth && (
              <DetailRow label="Date of Birth" value={
                new Date(profile.dateOfBirth as unknown as string).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })
              } />
            )}
            <DetailRow label="Member Since" value={memberSince} />
            {profile.memberNumber && (
              <DetailRow label="Member No." value={`#${profile.memberNumber}`} />
            )}
          </div>
        )}
      </div>

      {/* ── Emergency contact ────────────────────────────────────────── */}
      {!editing && (profile.emergencyContactName || profile.emergencyContactPhone) && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Emergency Contact
          </h3>
          <div className="space-y-0 divide-y divide-gray-100">
            <DetailRow label="Name"  value={profile.emergencyContactName ?? '—'} />
            <DetailRow label="Phone" value={profile.emergencyContactPhone ?? '—'} />
          </div>
        </div>
      )}

      {/* ── No emergency contact prompt ──────────────────────────────── */}
      {!editing && !profile.emergencyContactName && !profile.emergencyContactPhone && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">No emergency contact on file</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please add an emergency contact — it helps keep everyone safe at sessions.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="mt-2 text-xs font-medium text-amber-700 underline underline-offset-2"
            >
              Add now
            </button>
          </div>
        </div>
      )}

      {/* ── Change password ──────────────────────────────────────────── */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Change Password
        </h3>

        {passwordError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4">
            ✓ {passwordSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input type="password" required className="input"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="label">New password <span className="text-gray-400 font-normal">(min. 8 characters)</span></label>
            <input type="password" required minLength={8} className="input"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" required className="input"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} />
          </div>
          <button type="submit" disabled={savingPassword} className="btn-primary px-6 py-2">
            {savingPassword ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>

    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <dt className="w-32 text-sm text-gray-500 flex-shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}