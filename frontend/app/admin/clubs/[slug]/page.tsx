'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Club {
  id: number; slug: string; name: string; displayName: string
  tier: string; status: string; memberCount: number; tierCap: number; sessionCount: number
}

export default function ClubDetailPage() {
  const { slug }  = useParams<{ slug: string }>()
  const [club,    setClub]    = useState<Club | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/platform/clubs', { cache: 'no-store' })
      .then(r => r.json())
      .then((clubs: Club[]) => setClub(clubs.find(c => c.slug === slug) ?? null))
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
          { label: 'Members',  value: `${club.memberCount} / ${club.tierCap}` },
          { label: 'Sessions', value: club.sessionCount },
          { label: 'Status',   value: club.status },
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

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Subscription Tier</h3>
          <div className="space-y-2">
            {[
              { key: 'small',  label: 'Small — $49/mo (50 members)' },
              { key: 'medium', label: 'Medium — $99/mo (150 members)' },
              { key: 'large',  label: 'Large — $199/mo (unlimited)' },
            ].map(t => (
              <button key={t.key}
                onClick={() => updateTier(t.key)}
                disabled={saving || club.tier === t.key}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors
                  ${club.tier === t.key
                    ? 'bg-[#1a2744] text-white border-[#1a2744]'
                    : 'border-gray-200 text-gray-700 hover:border-[#1a2744] hover:text-[#1a2744]'
                  } disabled:opacity-50`}
              >
                {t.label}
              </button>
            ))}
          </div>
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