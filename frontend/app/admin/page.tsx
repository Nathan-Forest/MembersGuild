'use client'
import { useEffect, useState } from 'react'

interface HealthData {
  status: string
  checkedAt: string
  database: { connected: boolean; connectionCount: number; databaseSizeMb: number }
  clubs: { total: number; active: number; schemas: { slug: string; sizeMb: number; status: string }[] }
}

interface Club {
  id: number; slug: string; name: string; displayName: string
  tier: string; status: string; memberCount: number; tierCap: number
  sessionCount: number; createdAt: string
}

const statusBadge = (s: string) => ({
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}[s] ?? 'bg-gray-100 text-gray-600')

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])

  useEffect(() => {
    fetch('/api/platform/health', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null }
        return r.json()
      })
      .then(d => d && setHealth(d))
      .catch(() => { })

    fetch('/api/platform/clubs', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null }
        return r.json()
      })
      .then(d => d && setClubs(d))
      .catch(() => { })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Digital Guildhall operator view
        </p>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Platform Status', value: health?.status ?? '—',
            colour: health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'
          },
          { label: 'DB Connections', value: health?.database.connectionCount ?? '—', colour: 'text-gray-900' },
          { label: 'Database Size', value: health ? `${health.database.databaseSizeMb} MB` : '—', colour: 'text-gray-900' },
          { label: 'Active Clubs', value: health?.clubs.active ?? '—', colour: 'text-gray-900' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.colour}`}>{String(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Club list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Clubs</h2>
          <a href="/admin/clubs"
            className="text-sm text-[#1a2744] font-medium hover:underline">
            Manage →
          </a>
        </div>
        <div className="divide-y divide-gray-50">
          {clubs.map(club => (
            <div key={club.slug} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{club.displayName}</p>
                <p className="text-sm text-gray-500">{club.slug}.membersguild.com.au</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-600">{club.memberCount} / {club.tierCap} members</span>
                <span className="text-gray-600 capitalize">{club.tier}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(club.status)}`}>
                  {club.status}
                </span>
                <a href={`/admin/clubs/${club.slug}`}
                  className="text-[#1a2744] font-medium hover:underline">
                  View
                </a>
              </div>
            </div>
          ))}
          {clubs.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No clubs provisioned yet</p>
          )}
        </div>
      </div>
    </div>
  )
}