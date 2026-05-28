'use client'
import { useEffect, useState } from 'react'

interface Club {
  id: number; slug: string; name: string; displayName: string
  tier: string; status: string; memberCount: number; tierCap: number; sessionCount: number
}

const TIER_PRICES: Record<string, number> = { small: 49, medium: 99, large: 199 }

const statusBadge = (s: string) => ({
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}[s] ?? 'bg-gray-100 text-gray-600')

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [showModal, setShowModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [form, setForm] = useState({
    slug: '', name: '', displayName: '', tier: 'small',
    sport: 'swimming', primaryColor: '#1a56db', secondaryColor: '#1e429f', logoUrl: '',
    webmasterName: '',   // ← ADD
    webmasterEmail: '',
  })

  useEffect(() => {
    fetch('/api/platform/clubs', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null }
        return r.json()
      })
      .then(d => d && setClubs(d))
      .catch(() => { })
  }, [])

  // Poll job status after provisioning
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/platform/jobs/${jobId}`, { cache: 'no-store' })
      const data = await res.json()
      setJobStatus(data.status)
      if (data.status === 'completed') {
        clearInterval(interval)
        fetch('/api/platform/clubs', { cache: 'no-store' })
          .then(r => r.json()).then(setClubs)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId, jobStatus])

  async function handleProvision() {
    const res = await fetch('/api/platform/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        logoUrl: form.logoUrl || null,
        webmasterName: form.webmasterName || null,  // ← ADD
        webmasterEmail: form.webmasterEmail || null,  // ← ADD
      })
    })
    const data = await res.json()
    if (res.ok) {
      setJobId(data.provisioningJobId)
      setJobStatus('pending')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clubs</h1>
          <p className="text-sm text-gray-500 mt-1">{clubs.length} club{clubs.length !== 1 ? 's' : ''} on the platform</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e3460] transition-colors"
        >
          + Provision New Club
        </button>
      </div>

      {/* Job status banner */}
      {jobId && (
        <div className={`rounded-xl px-5 py-3 text-sm font-medium ${jobStatus === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
          jobStatus === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
          {jobStatus === 'completed' ? '✓ Club provisioned successfully' :
            jobStatus === 'failed' ? '✗ Provisioning failed — check logs' :
              '⏳ Provisioning in progress…'}
        </div>
      )}

      {/* Clubs table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              {['Club', 'Slug', 'Tier', 'Members', 'Sessions', 'Status', ''].map(h => (
                <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clubs.map(club => (
              <tr key={club.slug} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{club.displayName}</td>
                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{club.slug}</td>
                <td className="px-6 py-4 capitalize text-gray-600">{club.tier}</td>
                <td className="px-6 py-4 text-gray-600">{club.memberCount} / {club.tierCap}</td>
                <td className="px-6 py-4 text-gray-600">{club.sessionCount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(club.status)}`}>
                    {club.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <a href={`/admin/clubs/${club.slug}`}
                    className="text-[#1a2744] font-medium hover:underline">
                    Manage →
                  </a>
                </td>
              </tr>
            ))}
            {clubs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                  No clubs provisioned yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Provision modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Provision New Club</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Slug', key: 'slug', placeholder: 'bsm' },
                { label: 'Full Name', key: 'name', placeholder: 'Brisbane Southside Masters Swimming' },
                { label: 'Display Name', key: 'displayName', placeholder: 'BSM Swimming' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]"
                  />
                </div>
              ))}

              {/* Webmaster section */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                  Webmaster Account
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Webmaster Name
                    </label>
                    <input
                      value={form.webmasterName}
                      onChange={e => setForm(p => ({ ...p, webmasterName: e.target.value }))}
                      placeholder="Alex Morgan"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Webmaster Email
                    </label>
                    <input
                      type="email"
                      value={form.webmasterEmail}
                      onChange={e => setForm(p => ({ ...p, webmasterEmail: e.target.value }))}
                      placeholder="alex@club.com.au"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      A webmaster account will be created. Credentials appear in server logs until email is wired up.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tier</label>
                  <select
                    value={form.tier}
                    onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]"
                  >
                    <option value="small">Small — $49/mo (50 members)</option>
                    <option value="medium">Medium — $99/mo (150 members)</option>
                    <option value="large">Large — $199/mo (unlimited)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sport</label>
                  <select
                    value={form.sport}
                    onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]"
                  >
                    <option value="swimming">Swimming</option>
                    <option value="rowing">Rowing</option>
                    <option value="cycling">Cycling</option>
                    <option value="triathlon">Triathlon</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Primary Colour</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.primaryColor}
                      onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
                      className="h-9 w-12 rounded cursor-pointer border border-gray-300" />
                    <input value={form.primaryColor}
                      onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Secondary Colour</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.secondaryColor}
                      onChange={e => setForm(p => ({ ...p, secondaryColor: e.target.value }))}
                      className="h-9 w-12 rounded cursor-pointer border border-gray-300" />
                    <input value={form.secondaryColor}
                      onChange={e => setForm(p => ({ ...p, secondaryColor: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                onClick={handleProvision}
                disabled={!form.slug || !form.name || !form.displayName}
                className="bg-[#1a2744] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e3460] disabled:opacity-50 transition-colors"
              >
                Provision Club
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}