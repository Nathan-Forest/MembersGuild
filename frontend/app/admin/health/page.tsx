'use client'
import { useEffect, useState } from 'react'

interface HealthData {
  status: string
  checkedAt: string
  database: { connected: boolean; connectionCount: number; databaseSizeMb: number; databaseSizeBytes: number }
  clubs: { total: number; active: number; schemas: { slug: string; schemaName: string; status: string; sizeMb: number }[] }
}

export default function HealthPage() {
  const [health, setHealth]   = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch('/api/platform/health', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setHealth(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Health</h1>
          <p className="text-sm text-gray-500 mt-1">
            {health ? `Last checked ${new Date(health.checkedAt).toLocaleTimeString()}` : 'Checking…'}
          </p>
        </div>
        <button onClick={load}
          className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e3460] transition-colors">
          Refresh
        </button>
      </div>

      {/* Status banner */}
      {health && (
        <div className={`rounded-xl px-5 py-4 border ${
          health.status === 'healthy'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <p className="font-semibold text-lg">
            {health.status === 'healthy' ? '✓ Platform Healthy' : '✗ Platform Unhealthy'}
          </p>
          {(health as any).error && (
            <p className="text-sm mt-1 opacity-80">{(health as any).error}</p>
          )}
        </div>
      )}

      {/* Database stats */}
      {health?.database && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Database</h2>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              { label: 'Connection',       value: health.database.connected ? 'Connected' : 'Disconnected',
                colour: health.database.connected ? 'text-green-600' : 'text-red-600' },
              { label: 'Active Connections', value: health.database.connectionCount, colour: 'text-gray-900' },
              { label: 'Database Size',      value: `${health.database.databaseSizeMb} MB`, colour: 'text-gray-900' },
            ].map(s => (
              <div key={s.label} className="px-6 py-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.colour}`}>{String(s.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Club schemas */}
      {health?.clubs && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Club Schemas</h2>
            <span className="text-sm text-gray-500">{health.clubs.active} active / {health.clubs.total} total</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                {['Slug', 'Schema', 'Status', 'Size'].map(h => (
                  <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {health.clubs.schemas.map(s => (
                <tr key={s.slug}>
                  <td className="px-6 py-3 font-medium text-gray-900">{s.slug}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{s.schemaName}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{s.sizeMb} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}