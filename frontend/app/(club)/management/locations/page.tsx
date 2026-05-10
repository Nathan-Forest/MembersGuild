'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface Location {
  id: number
  name: string
  address: string | null
  phone: string | null
  capacity: number | null
  isActive: boolean
}

const emptyForm = { name: '', address: '', phone: '', capacity: '' }

export default function LocationsPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    const role = user.role as UserRole
    setCurrentRole(role)
    if (!['coach', 'committee', 'webmaster'].includes(role)) {
      router.replace('/dashboard')
      return
    }
    loadLocations()
  }, [router])

  async function loadLocations() {
    setLoading(true)
    try {
      const data = await api.get<Location[]>('/locations')
      setLocations(data)
    } catch { }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(loc: Location) {
    setEditing(loc)
    setForm({
      name:     loc.name,
      address:  loc.address ?? '',
      phone:    loc.phone ?? '',
      capacity: loc.capacity?.toString() ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        name:     form.name.trim(),
        address:  form.address.trim() || null,
        phone:    form.phone.trim() || null,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        isActive: editing?.isActive ?? true,
      }

      if (editing) {
        await api.put(`/locations/${editing.id}`, payload)
      } else {
        await api.post('/locations', payload)
      }

      setModalOpen(false)
      await loadLocations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(loc: Location) {
    try {
      await api.put(`/locations/${loc.id}`, {
        name:     loc.name,
        address:  loc.address,
        phone:    loc.phone,
        capacity: loc.capacity,
        isActive: !loc.isActive,
      })
      await loadLocations()
    } catch { }
  }

  async function handleDelete(loc: Location) {
    if (!confirm(`Deactivate "${loc.name}"? It will no longer appear in session dropdowns.`)) return
    try {
      await api.delete(`/locations/${loc.id}`)
      await loadLocations()
    } catch { }
  }

  const isWebmaster = currentRole === 'webmaster'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pool and venue locations used when scheduling sessions
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary px-4 py-2">
          + Add Location
        </button>
      </div>

      {/* Locations list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 animate-pulse h-20 bg-gray-100" />
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📍</p>
          <p className="text-sm font-medium text-gray-600">No locations yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add your first pool or venue to start scheduling sessions
          </p>
          <button onClick={openAdd} className="btn-primary px-6 py-2 mt-4">
            Add Location
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map(loc => (
            <div key={loc.id} className={`card p-4 flex items-center gap-4 ${!loc.isActive ? 'opacity-60' : ''}`}>
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                📍
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{loc.name}</p>
                  {!loc.isActive && (
                    <span className="badge badge-gray text-xs">Inactive</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  {loc.address && <span>📌 {loc.address}</span>}
                  {loc.phone && <span>📞 {loc.phone}</span>}
                  {loc.capacity && <span>👥 Capacity: {loc.capacity}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(loc)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Edit
                </button>
                {isWebmaster && (
                  <button
                    onClick={() => handleDelete(loc)}
                    className="btn-danger text-xs px-3 py-1.5"
                  >
                    {loc.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {editing ? 'Edit Location' : 'Add Location'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="label">
                  Location name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" required className="input"
                  placeholder="e.g. Brisbane Aquatic Centre"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Address</label>
                <input
                  type="text" className="input"
                  placeholder="e.g. 420 Sleeman Sports Complex, Chandler"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel" className="input"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Capacity</label>
                  <input
                    type="number" className="input" min="1"
                    placeholder="e.g. 25"
                    value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Location'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}