'use client'
import { useEffect, useState } from 'react'

const ALL_FEATURES = [
  { key: 'calendar',   label: 'Session Calendar & Booking' },
  { key: 'mysessions', label: 'My Sessions' },
  { key: 'attendance', label: 'Attendance Tracking' },
  { key: 'training',   label: 'Training & Personal Bests' },
  { key: 'shop',       label: 'Swim Shop' },
  { key: 'myaccount',  label: 'Credits & My Account' },
  { key: 'news',       label: 'Club News & Updates' },
]

interface Package {
  id: number; name: string; type: string; price: number
  memberCap: number; description: string | null
  isActive: boolean; sortOrder: number; featureKeys: string[]
}

const typeBadge = (t: string) => t === 'tier'
  ? 'bg-[#1a2744] text-white'
  : 'bg-amber-100 text-amber-800'

export default function PackagesPage() {
  const [packages,    setPackages]    = useState<Package[]>([])
  const [showForm,    setShowForm]    = useState(false)
  const [editPkg,     setEditPkg]     = useState<Package | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'tier', price: '', memberCap: '50',
    description: '', featureKeys: [] as string[]
  })

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/platform/packages', { cache: 'no-store' })
    const data = await res.json()
    setPackages(data)
  }

  function openCreate() {
    setEditPkg(null)
    setForm({ name: '', type: 'tier', price: '', memberCap: '50', description: '', featureKeys: [] })
    setShowForm(true)
  }

  function openEdit(pkg: Package) {
    setEditPkg(pkg)
    setForm({
      name:        pkg.name,
      type:        pkg.type,
      price:       String(pkg.price),
      memberCap:   String(pkg.memberCap),
      description: pkg.description ?? '',
      featureKeys: pkg.featureKeys,
    })
    setShowForm(true)
  }

  function toggleFeature(key: string) {
    setForm(p => ({
      ...p,
      featureKeys: p.featureKeys.includes(key)
        ? p.featureKeys.filter(k => k !== key)
        : [...p.featureKeys, key]
    }))
  }

  async function handleSave() {
    if (!form.name || !form.price) return
    setSaving(true)

    const body = {
      name:        form.name,
      type:        form.type,
      price:       parseFloat(form.price),
      memberCap:   parseInt(form.memberCap),
      description: form.description || null,
      featureKeys: form.featureKeys,
      isActive:    true,
    }

    const url    = editPkg ? `/api/platform/packages/${editPkg.id}` : '/api/platform/packages'
    const method = editPkg ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (res.ok) { await load(); setShowForm(false) }
    setSaving(false)
  }

  async function handleToggleActive(pkg: Package) {
    await fetch(`/api/platform/packages/${pkg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pkg.name, price: pkg.price, memberCap: pkg.memberCap,
        description: pkg.description, isActive: !pkg.isActive,
        featureKeys: pkg.featureKeys,
      })
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define tiers and add-ons. Assign them to clubs in the Clubs section.
          </p>
        </div>
        <button onClick={openCreate}
          className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e3460] transition-colors">
          + New Package
        </button>
      </div>

      {/* Package list */}
      <div className="grid gap-4">
        {packages.map(pkg => (
          <div key={pkg.id}
            className={`bg-white rounded-xl shadow-sm border p-6 ${!pkg.isActive ? 'opacity-50' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{pkg.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge(pkg.type)}`}>
                      {pkg.type}
                    </span>
                    {!pkg.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        inactive
                      </span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{pkg.description}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-gray-900">
                  ${pkg.price}<span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pkg.memberCap === 999 ? 'Unlimited' : `Up to ${pkg.memberCap}`} members
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-2 mt-4">
              {pkg.featureKeys.map(k => {
                const f = ALL_FEATURES.find(f => f.key === k)
                return f ? (
                  <span key={k}
                    className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                    {f.label}
                  </span>
                ) : null
              })}
              {pkg.featureKeys.length === 0 && (
                <span className="text-xs text-gray-400 italic">No features assigned</span>
              )}
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
              <button onClick={() => openEdit(pkg)}
                className="text-sm text-[#1a2744] font-medium hover:underline">
                Edit
              </button>
              <span className="text-gray-300">·</span>
              <button onClick={() => handleToggleActive(pkg)}
                className="text-sm text-gray-400 hover:text-gray-600">
                {pkg.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {editPkg ? `Edit ${editPkg.name}` : 'New Package'}
              </h2>
              <button onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Small, Training Add-On"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]">
                    <option value="tier">Tier (base plan)</option>
                    <option value="addon">Add-On (extra)</option>
                  </select>
                </div>
              </div>

              {/* Price + Member Cap */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Monthly Price (AUD)
                  </label>
                  <input type="number" value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="49.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Member Cap
                  </label>
                  <input type="number" value={form.memberCap}
                    onChange={e => setForm(p => ({ ...p, memberCap: e.target.value }))}
                    placeholder="50"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
                  <p className="text-xs text-gray-400 mt-1">Use 999 for unlimited</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <input value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Short description shown to admins"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
              </div>

              {/* Features */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Included Features
                </label>
                <div className="space-y-2">
                  {ALL_FEATURES.map(f => (
                    <label key={f.key}
                      className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input type="checkbox"
                        checked={form.featureKeys.includes(f.key)}
                        onChange={() => toggleFeature(f.key)}
                        className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.price}
                className="bg-[#1a2744] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e3460] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editPkg ? 'Save Changes' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}