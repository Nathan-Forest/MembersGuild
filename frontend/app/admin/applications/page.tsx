'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Application {
  id: number
  status: string
  clubName: string
  displayName: string
  sportType: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  estimatedMembers: number | null
  packageId: number | null
  packageName: string | null
  packagePrice: number | null
  setupFeePaidAt: string | null
  submittedAt: string
  notes: string | null
}

const STATUS_TABS = [
  { value: '',                label: 'All' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'pending_onboard', label: 'Ready to Onboard' },
  { value: 'onboarded',       label: 'Onboarded' },
  { value: 'rejected',        label: 'Rejected' },
]

const statusBadge = (s: string) => ({
  pending_payment: 'bg-yellow-100 text-yellow-700',
  pending_onboard: 'bg-blue-100 text-blue-700',
  onboarded:       'bg-green-100 text-green-700',
  rejected:        'bg-red-100 text-red-700',
}[s] ?? 'bg-gray-100 text-gray-600')

const statusLabel = (s: string) => ({
  pending_payment: 'Pending Payment',
  pending_onboard: 'Ready to Onboard',
  onboarded:       'Onboarded',
  rejected:        'Rejected',
}[s] ?? s)

function generateSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 20)
}

export default function ApplicationsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState('')
  const [error, setError]               = useState('')

  // Onboard modal
  const [onboarding, setOnboarding]         = useState<Application | null>(null)
  const [slug, setSlug]                     = useState('')
  const [onboardNotes, setOnboardNotes]     = useState('')
  const [onboardLoading, setOnboardLoading] = useState(false)
  const [onboardError, setOnboardError]     = useState('')
  const [jobId, setJobId]                   = useState<string | null>(null)

  // Reject
  const [rejecting, setRejecting]       = useState<Application | null>(null)
  const [rejectNotes, setRejectNotes]   = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  useEffect(() => { loadApplications() }, [tab])

  async function loadApplications() {
    setLoading(true)
    try {
      const url = tab ? `/api/platform/applications?status=${tab}` : '/api/platform/applications'
      const res = await fetch(url, { cache: 'no-store' })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      setApplications(await res.json())
    } catch {
      setError('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  function openOnboard(app: Application) {
    setOnboarding(app)
    setSlug(generateSlug(app.displayName))
    setOnboardNotes('')
    setOnboardError('')
    setJobId(null)
  }

  async function handleOnboard() {
    if (!onboarding) return
    if (!slug.trim()) { setOnboardError('Slug is required'); return }
    setOnboardLoading(true); setOnboardError('')
    try {
      const res = await fetch(`/api/platform/applications/${onboarding.id}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), notes: onboardNotes || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to onboard')
      setJobId(data.provisioningJobId)
      await loadApplications()
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : 'Failed to onboard')
    } finally {
      setOnboardLoading(false)
    }
  }

  async function handleReject() {
    if (!rejecting) return
    setRejectLoading(true)
    try {
      await fetch(`/api/platform/applications/${rejecting.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectNotes || null }),
      })
      setRejecting(null)
      setRejectNotes('')
      await loadApplications()
    } catch { }
    finally { setRejectLoading(false) }
  }

  const pendingCount = applications.filter(a => a.status === 'pending_onboard').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Club registration applications and onboarding pipeline
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm text-blue-700 font-medium">
            🔔 {pendingCount} ready to onboard
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? 'border-[#1a2744] text-[#1a2744]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.value === 'pending_onboard' && pendingCount > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Applications list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">No applications found</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {applications.map(app => (
              <div key={app.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-gray-900">{app.clubName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(app.status)}`}>
                        {statusLabel(app.status)}
                      </span>
                      {app.packageName && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {app.packageName} · ${app.packagePrice}/mo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span>👤 {app.contactName}</span>
                      <a href={`mailto:${app.contactEmail}`}
                        className="text-[#1a2744] hover:underline">
                        {app.contactEmail}
                      </a>
                      {app.contactPhone && <span>📞 {app.contactPhone}</span>}
                      {app.estimatedMembers && <span>~{app.estimatedMembers} members</span>}
                      <span className="text-gray-400">
                        {new Date(app.submittedAt).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {app.notes && (
                      <p className="mt-1 text-xs text-gray-400 italic">{app.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {app.status === 'pending_onboard' && (
                      <>
                        <button onClick={() => openOnboard(app)}
                          className="bg-[#1a2744] text-white text-sm px-4 py-1.5 rounded-lg hover:bg-[#1a2744]/90 transition-colors font-medium">
                          Onboard →
                        </button>
                        <button onClick={() => { setRejecting(app); setRejectNotes('') }}
                          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                    {app.status === 'onboarded' && (
                      <a href={`/admin/clubs/${generateSlug(app.displayName)}`}
                        className="text-sm text-[#1a2744] font-medium hover:underline">
                        View Club →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Onboard Modal ──────────────────────────────────────────────────── */}
      {onboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Onboard Club</h2>
                <p className="text-sm text-gray-500 mt-0.5">{onboarding.clubName}</p>
              </div>
              <button onClick={() => setOnboarding(null)}
                className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {jobId ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                    <p className="text-2xl mb-2">🚀</p>
                    <p className="text-sm font-semibold text-green-800">Provisioning started!</p>
                    <p className="text-xs text-green-600 mt-1">
                      Job ID: {jobId.slice(0, 8)}…
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    The club portal will be live within ~15 seconds.
                    Check the Health page to confirm.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => { setOnboarding(null); setJobId(null) }}
                      className="flex-1 bg-[#1a2744] text-white py-2 rounded-lg text-sm font-medium">
                      Done
                    </button>
                    <button onClick={() => router.push('/admin/health')}
                      className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">
                      View Health →
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Club</span>
                      <span className="font-medium">{onboarding.clubName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Portal name</span>
                      <span className="font-medium">{onboarding.displayName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sport</span>
                      <span className="font-medium">{onboarding.sportType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Package</span>
                      <span className="font-medium">{onboarding.packageName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Webmaster</span>
                      <span className="font-medium">{onboarding.contactEmail}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Club Slug
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">*.membersguild.com.au/</span>
                      <input
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]"
                        value={slug}
                        onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                        placeholder="bsmswimming"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Lowercase letters and numbers only. Cannot be changed after onboarding.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Internal Notes (optional)
                    </label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744] resize-none"
                      rows={2}
                      value={onboardNotes}
                      onChange={e => setOnboardNotes(e.target.value)}
                      placeholder="Any notes about this onboarding…"
                    />
                  </div>

                  {onboardError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {onboardError}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setOnboarding(null)}
                      className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">
                      Cancel
                    </button>
                    <button onClick={handleOnboard} disabled={onboardLoading}
                      className="flex-1 bg-[#1a2744] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                      {onboardLoading ? 'Provisioning…' : 'Confirm & Onboard →'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h2 className="font-bold text-gray-900 mb-1">Reject Application</h2>
              <p className="text-sm text-gray-500 mb-4">{rejecting.clubName}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  rows={3}
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="e.g. Duplicate application, unsuitable club type…"
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setRejecting(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={rejectLoading}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                  {rejectLoading ? 'Rejecting…' : 'Reject Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}