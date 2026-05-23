'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface CustomRole {
  id: number
  roleName: string
  displayLabel: string
  inheritsFrom: string[]
}

interface RolesData {
  baseRoles: string[]
  lockedRoles: string[]
  customRoles: CustomRole[]
}

const BASE_ROLE_LABELS: Record<string, string> = {
  committee:  'Committee',
  membership: 'Membership',
  finance:    'Finance',
}

const BASE_ROLE_DESC: Record<string, string> = {
  committee:  'Session management, attendance, shop orders',
  membership: 'Member profiles, role changes, member import',
  finance:    'Credits, payment confirmation, financial reports',
}

export default function RolesPage() {
  const router = useRouter()
  const [data, setData]       = useState<RolesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    roleName: '', displayLabel: '', inheritsFrom: [] as string[]
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || user.role !== 'webmaster') { router.replace('/dashboard'); return }
    api.get<RolesData>('/roles').then(setData).finally(() => setLoading(false))
  }, [router])

  function toggleBase(base: string) {
    setForm(f => ({
      ...f,
      inheritsFrom: f.inheritsFrom.includes(base)
        ? f.inheritsFrom.filter(r => r !== base)
        : [...f.inheritsFrom, base]
    }))
  }

  async function handleCreate() {
    if (!form.displayLabel.trim()) { setError('Display label required'); return }
    if (!form.roleName.trim())     { setError('Role name required'); return }
    if (form.inheritsFrom.length === 0) { setError('Select at least one base role'); return }
    setSaving(true); setError('')
    try {
      const created = await api.post<CustomRole>('/roles', {
        roleName:    form.roleName.toLowerCase().replace(/\s+/g, '_'),
        displayLabel: form.displayLabel.trim(),
        inheritsFrom: form.inheritsFrom,
      })
      setData(d => d ? { ...d, customRoles: [...d.customRoles, created] } : d)
      setForm({ roleName: '', displayLabel: '', inheritsFrom: [] })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, label: string) {
    if (!confirm(`Delete the "${label}" role? Members with this role must be reassigned first.`)) return
    try {
      await api.delete(`/roles/${id}`)
      setData(d => d ? { ...d, customRoles: d.customRoles.filter(r => r.id !== id) } : d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role')
    }
  }

  if (loading) return <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Roles</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create roles that combine permissions from the base roles below
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
            + New Role
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Base roles — reference */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">🔒 Built-in Base Roles</p>
          <p className="text-xs text-gray-400 mt-0.5">These cannot be modified. Custom roles inherit from these.</p>
        </div>
        <div className="divide-y divide-gray-50">
          {data?.baseRoles.map(role => (
            <div key={role} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{BASE_ROLE_LABELS[role] ?? role}</p>
                <p className="text-xs text-gray-400">{BASE_ROLE_DESC[role]}</p>
              </div>
              <span className="badge bg-gray-100 text-gray-500 text-xs">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">New Custom Role</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Label</label>
            <p className="text-xs text-gray-400 mb-2">What members see — e.g. "President", "Club Secretary"</p>
            <input type="text" className="input" placeholder="e.g. President"
              value={form.displayLabel}
              onChange={e => {
                const label = e.target.value
                setForm(f => ({
                  ...f,
                  displayLabel: label,
                  roleName: label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                }))
              }} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role Key</label>
            <p className="text-xs text-gray-400 mb-2">Auto-generated — stored internally</p>
            <input type="text" className="input font-mono text-sm bg-gray-50" readOnly
              value={form.roleName} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Inherits Permissions From</label>
            <p className="text-xs text-gray-400 mb-3">Select which base roles this role combines</p>
            <div className="space-y-2">
              {data?.baseRoles.map(base => (
                <label key={base} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                  style={form.inheritsFrom.includes(base)
                    ? { borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary)10' }
                    : { borderColor: '#e5e7eb' }}>
                  <input type="checkbox" className="mt-0.5 accent-[var(--color-primary)]"
                    checked={form.inheritsFrom.includes(base)}
                    onChange={() => toggleBase(base)} />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{BASE_ROLE_LABELS[base] ?? base}</p>
                    <p className="text-xs text-gray-400">{BASE_ROLE_DESC[base]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {form.inheritsFrom.length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
              ℹ️ "{form.displayLabel || 'This role'}" will have all permissions of:{' '}
              {form.inheritsFrom.map(r => BASE_ROLE_LABELS[r] ?? r).join(' + ')}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowForm(false); setError('') }} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? 'Creating…' : 'Create Role'}
            </button>
          </div>
        </div>
      )}

      {/* Custom roles list */}
      {data?.customRoles.length === 0 && !showForm ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-3xl">🎭</p>
          <p className="text-sm text-gray-500">No custom roles yet</p>
          <p className="text-xs text-gray-400">
            Create a "President" that combines Committee + Membership + Finance,<br />
            or a "Secretary" that combines Committee + Membership.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary px-6 py-2 text-sm mt-2">
            Create First Role
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.customRoles.map(role => (
            <div key={role.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{role.displayLabel}</span>
                    <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      {role.roleName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-xs text-gray-400">Inherits:</span>
                    {role.inheritsFrom.map(base => (
                      <span key={base} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                        {BASE_ROLE_LABELS[base] ?? base}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleDelete(role.id, role.displayLabel)}
                  className="btn-danger text-xs px-3 py-1.5 flex-shrink-0">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}