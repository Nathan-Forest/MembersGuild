'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import type { UserRole } from '@/types'

interface Location {
  id: number
  name: string
  address: string | null
  phone: string | null
  capacity: number | null
  isActive: boolean
}

interface Pool {
  id: number
  locationId: number
  name: string
  hireFeePerHourPerLane: number | null
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
  const [poolTrackingEnabled, setPoolTrackingEnabled] = useState(false)
  const [expandedLocationId, setExpandedLocationId] = useState<number | null>(null)
  const [pools, setPools] = useState<Record<number, Pool[]>>({})
  const [poolModalOpen, setPoolModalOpen] = useState(false)
  const [poolModalLocationId, setPoolModalLocationId] = useState<number | null>(null)
  const [editingPool, setEditingPool] = useState<Pool | null>(null)
  const [poolForm, setPoolForm] = useState({ name: '', fee: '' })
  const [savingPool, setSavingPool] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    const role = user.role as UserRole
    setCurrentRole(role)
    if (!hasPermission(user, 'coach', 'committee', 'webmaster')) {
      router.replace('/dashboard')
      return
    }
    loadLocations()
    api.get<{ poolTrackingEnabled: boolean }>('/settings/labels')
      .then(d => setPoolTrackingEnabled((d as any).poolTrackingEnabled ?? false))
      .catch(() => { })
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
      name: loc.name,
      address: loc.address ?? '',
      phone: loc.phone ?? '',
      capacity: loc.capacity?.toString() ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  async function loadPools(locationId: number) {
    try {
      const data = await api.get<Pool[]>(`/locations/${locationId}/pools`)
      setPools(prev => ({ ...prev, [locationId]: data }))
    } catch { }
  }

  function toggleExpand(locationId: number) {
    if (expandedLocationId === locationId) {
      setExpandedLocationId(null)
    } else {
      setExpandedLocationId(locationId)
      if (!pools[locationId]) loadPools(locationId)
    }
  }

  function openAddPool(locationId: number) {
    setPoolModalLocationId(locationId)
    setEditingPool(null)
    setPoolForm({ name: '', fee: '' })
    setPoolModalOpen(true)
  }

  function openEditPool(locationId: number, pool: Pool) {
    setPoolModalLocationId(locationId)
    setEditingPool(pool)
    setPoolForm({ name: pool.name, fee: pool.hireFeePerHourPerLane?.toString() ?? '' })
    setPoolModalOpen(true)
  }

  async function handleSavePool(e: React.FormEvent) {
    e.preventDefault()
    if (!poolModalLocationId) return
    setSavingPool(true)
    try {
      const payload = {
        name: poolForm.name.trim(),
        hireFeePerHourPerLane: poolForm.fee ? parseFloat(poolForm.fee) : null,
        ...(editingPool ? { isActive: editingPool.isActive } : {}),
      }
      if (editingPool) {
        await api.put(`/locations/pools/${editingPool.id}`, payload)
      } else {
        await api.post(`/locations/${poolModalLocationId}/pools`, payload)
      }
      setPoolModalOpen(false)
      await loadPools(poolModalLocationId)
    } catch { }
    finally { setSavingPool(false) }
  }

  async function handleTogglePoolActive(locationId: number, pool: Pool) {
    try {
      await api.put(`/locations/pools/${pool.id}`, {
        name: pool.name,
        hireFeePerHourPerLane: pool.hireFeePerHourPerLane,
        isActive: !pool.isActive,
      })
      await loadPools(locationId)
    } catch { }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
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
        name: loc.name,
        address: loc.address,
        phone: loc.phone,
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
            <div key={loc.id} className={`card p-4 ${!loc.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-4">
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
                  {poolTrackingEnabled && (
                    <button onClick={() => toggleExpand(loc.id)} className="btn-secondary text-xs px-3 py-1.5">
                      {expandedLocationId === loc.id ? 'Hide Pools' : 'Manage Pools'}
                    </button>
                  )}
                  <button onClick={() => openEdit(loc)} className="btn-secondary text-xs px-3 py-1.5">
                    Edit
                  </button>
                  {isWebmaster && (
                    <button onClick={() => handleDelete(loc)} className="btn-danger text-xs px-3 py-1.5">
                      {loc.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>

              {poolTrackingEnabled && expandedLocationId === loc.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pools</p>
                    {isWebmaster && (
                      <button onClick={() => openAddPool(loc.id)} className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                        + Add Pool
                      </button>
                    )}
                  </div>

                  {!pools[loc.id] || pools[loc.id].length === 0 ? (
                    <p className="text-xs text-gray-400">No pools added for this location yet</p>
                  ) : (
                    <div className="space-y-2">
                      {pools[loc.id].map(pool => (
                        <div key={pool.id} className={`flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 ${!pool.isActive ? 'opacity-50' : ''}`}>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{pool.name}</p>
                            <p className="text-xs text-gray-400">
                              {pool.hireFeePerHourPerLane != null ? `$${pool.hireFeePerHourPerLane.toFixed(2)}/hr/lane` : 'No fee set'}
                            </p>
                          </div>
                          {isWebmaster && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openEditPool(loc.id, pool)} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                                Edit
                              </button>
                              <button onClick={() => handleTogglePoolActive(loc.id, pool)} className="text-xs text-gray-400 hover:text-gray-600">
                                {pool.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

      {poolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editingPool ? 'Edit Pool' : 'Add Pool'}</h2>
              <button onClick={() => setPoolModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSavePool} className="p-6 space-y-4">
              <div>
                <label className="label">Pool Name <span className="text-red-500">*</span></label>
                <input type="text" required className="input" placeholder="e.g. 50m Pool"
                  value={poolForm.name}
                  onChange={e => setPoolForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Hire Fee ($ per hour per lane)</label>
                <input type="number" step="0.01" min="0" className="input" placeholder="e.g. 12.50"
                  value={poolForm.fee}
                  onChange={e => setPoolForm(f => ({ ...f, fee: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingPool} className="btn-primary flex-1 py-2.5">
                  {savingPool ? 'Saving…' : editingPool ? 'Save Changes' : 'Add Pool'}
                </button>
                <button type="button" onClick={() => setPoolModalOpen(false)} className="btn-secondary flex-1 py-2.5">
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