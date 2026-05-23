'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Club {
  id: number; slug: string; name: string; displayName: string
  tier: string; status: string; memberCount: number; tierCap: number; sessionCount: number
}

export default function ClubDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [club, setClub] = useState<Club | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [packages, setPackages] = useState<Package[]>([])
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [selectedPkgs, setSelectedPkgs] = useState<number[]>([])
  const [discount, setDiscount] = useState({
    type: 'none', value: '0', note: ''
  })
  const [savingBilling, setSavingBilling] = useState(false)

  interface Package {
    id: number; name: string; type: string; price: number
    memberCap: number; featureKeys: string[]
    isActive: boolean 
  }
  interface BillingData {
    discountType: string; discountValue: number; discountNote: string | null
    grossMonthly: number; netMonthly: number
    packages: Package[]
  }

  const params = useParams()

  useEffect(() => {
    if (!slug) return
    fetch(`/api/platform/clubs/${slug}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setClub)
      .catch(() => { })
    fetch('/api/platform/packages', { cache: 'no-store' })
      .then(r => r.json()).then(setPackages).catch(() => { })

    fetch(`/api/platform/clubs/${slug}/billing`, { cache: 'no-store' })
      .then(r => r.json())
      .then((b: BillingData) => {
        setBilling(b)
        setSelectedPkgs(b.packages.map(p => p.id))
        setDiscount({
          type: b.discountType,
          value: String(b.discountValue),
          note: b.discountNote ?? ''
        })
      }).catch(() => { })
  }, [slug])

  async function updateStatus(status: string) {
    setSaving(true)
    const res = await fetch(`/api/platform/clubs/${slug}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    if (res.ok) {
      setClub(prev => prev ? { ...prev, status } : null)
      setMessage(`Status updated to ${status}`)
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function updateTier(tier: string) {
    setSaving(true)
    const prices: Record<string, number> = { small: 49, medium: 99, large: 199 }
    const res = await fetch(`/api/platform/clubs/${slug}/tier`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, monthlyAmount: prices[tier] })
    })
    if (res.ok) {
      setClub(prev => prev ? { ...prev, tier } : null)
      setMessage(`Tier updated to ${tier}`)
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleSaveBilling() {
    setSavingBilling(true)
    await fetch(`/api/platform/clubs/${slug}/billing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discountType: discount.type,
        discountValue: parseFloat(discount.value) || 0,
        discountNote: discount.note || null,
        packageIds: selectedPkgs,
      })
    })
    // Reload billing
    const res = await fetch(`/api/platform/clubs/${slug}/billing`, { cache: 'no-store' })
    const b: BillingData = await res.json()
    setBilling(b)
    setSavingBilling(false)
  }

  if (!club) return <div className="text-gray-400 text-sm">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin/clubs" className="text-sm text-gray-400 hover:text-gray-600">← Clubs</a>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{club.displayName}</h1>
        <p className="text-sm text-gray-500 font-mono mt-1">{club.slug}.membersguild.com.au</p>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          ✓ {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Members', value: `${club.memberCount} / ${club.tierCap}` },
          { label: 'Sessions', value: club.sessionCount },
          { label: 'Status', value: club.status },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1 capitalize">{String(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Subscription Status</h3>
          <div className="space-y-2">
            {['active', 'suspended', 'cancelled'].map(s => (
              <button key={s}
                onClick={() => updateStatus(s)}
                disabled={saving || club.status === s}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors
                  ${club.status === s
                    ? 'bg-[#1a2744] text-white border-[#1a2744]'
                    : 'border-gray-200 text-gray-700 hover:border-[#1a2744] hover:text-[#1a2744]'
                  } disabled:opacity-50`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Billing & Packages */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Billing & Packages</h3>
            {billing && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Monthly</p>
                <p className="text-lg font-bold text-gray-900">
                  ${billing.netMonthly.toFixed(2)}
                  {billing.grossMonthly !== billing.netMonthly && (
                    <span className="text-xs text-gray-400 line-through ml-2">
                      ${billing.grossMonthly.toFixed(2)}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Package selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Assigned Packages</label>
            <div className="space-y-2">
              {packages.filter(p => p.isActive).map(pkg => (
                <label key={pkg.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-[#1a2744] transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="checkbox"
                      checked={selectedPkgs.includes(pkg.id)}
                      onChange={() => setSelectedPkgs(p =>
                        p.includes(pkg.id) ? p.filter(x => x !== pkg.id) : [...p, pkg.id]
                      )}
                      className="rounded border-gray-300" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{pkg.name}</p>
                      <p className="text-xs text-gray-400">
                        {pkg.memberCap === 999 ? 'Unlimited' : `${pkg.memberCap} member`} cap
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">${pkg.price}/mo</span>
                </label>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Discount</label>
            <div className="grid grid-cols-2 gap-3">
              <select value={discount.type}
                onChange={e => setDiscount(p => ({ ...p, type: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]">
                <option value="none">No discount</option>
                <option value="percentage">Percentage off</option>
                <option value="free_forever">Free forever</option>
              </select>
              {discount.type === 'percentage' && (
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100"
                    value={discount.value}
                    onChange={e => setDiscount(p => ({ ...p, value: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
                  <span className="text-sm text-gray-500 flex-shrink-0">% off</span>
                </div>
              )}
              {discount.type === 'free_forever' && (
                <div className="flex items-center">
                  <span className="text-sm text-green-600 font-medium">100% — no charge</span>
                </div>
              )}
            </div>
            <input value={discount.note}
              onChange={e => setDiscount(p => ({ ...p, note: e.target.value }))}
              placeholder="Note e.g. BSM founding club — free for life"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
          </div>

          <button onClick={handleSaveBilling} disabled={savingBilling}
            className="w-full bg-[#1a2744] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e3460] disabled:opacity-50 transition-colors">
            {savingBilling ? 'Saving…' : 'Save Billing'}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-red-100">
        <h3 className="font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">
          Deactivates the club. Data is preserved — this is a soft delete.
        </p>
        <button
          onClick={async () => {
            if (!confirm(`Deactivate ${club.displayName}? This will suspend their portal.`)) return
            await fetch(`/api/platform/clubs/${slug}`, { method: 'DELETE' })
            window.location.href = '/admin/clubs'
          }}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          Deactivate Club
        </button>
      </div>
    </div>
  )
}