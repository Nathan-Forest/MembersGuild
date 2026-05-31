'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Club {
  id: number; slug: string; name: string; displayName: string
  tier: string; status: string; memberCount: number; tierCap: number
  sessionCount: number; sportType: string | null; website: string | null
  webmasterName: string | null; webmasterEmail: string | null
  webmasterPhone: string | null; onboardedAt: string | null
  address: string | null; phone: string | null
}

interface Package {
  id: number; name: string; type: string; price: number
  memberCap: number; featureKeys: string[]; isActive: boolean
}

interface BillingData {
  discountType: string; discountValue: number; discountNote: string | null
  grossMonthly: number; netMonthly: number; packages: Package[]
}

const statusColour = (s: string) => ({
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}[s] ?? 'bg-gray-100 text-gray-500')

export default function ClubDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [club, setClub] = useState<Club | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [selectedPkgs, setSelectedPkgs] = useState<number[]>([])
  const [discount, setDiscount] = useState({ type: 'none', value: '0', note: '' })
  const [saving, setSaving] = useState(false)
  const [savingBilling, setSavingBilling] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [webmasterActive, setWebmasterActive] = useState<boolean | null>(null)
  const [togglingWebmaster, setTogglingWebmaster] = useState(false)
  const [graceModal, setGraceModal] = useState(false)
  const [graceDays, setGraceDays] = useState('7')
  const [graceNote, setGraceNote] = useState('')
  const [savingGrace, setSavingGrace] = useState(false)
  const [gracePeriodEnds, setGracePeriodEnds] = useState<string | null>(null)


  // Reset password modal state
  const [resetModal, setResetModal] = useState<{
    open: boolean; loading: boolean; tempPassword: string | null
  }>({ open: false, loading: false, tempPassword: null })

  // Disable account modal state
  const [disableModal, setDisableModal] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/platform/clubs/${slug}`, { cache: 'no-store' })
      .then(r => r.json()).then(setClub).catch(() => { })

    fetch('/api/platform/packages', { cache: 'no-store' })
      .then(r => r.json()).then(setPackages).catch(() => { })

    fetch(`/api/platform/clubs/${slug}/billing`, { cache: 'no-store' })
      .then(r => r.json())
      .then((b: BillingData) => {
        setBilling(b)
        setSelectedPkgs(b.packages.map(p => p.id))
        setDiscount({ type: b.discountType, value: String(b.discountValue), note: b.discountNote ?? '' })
      }).catch(() => { })

    fetch(`/api/platform/clubs/${slug}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((c: Club & { gracePeriodEnds?: string }) => {
        setClub(c)
        if (c.gracePeriodEnds) setGracePeriodEnds(c.gracePeriodEnds)
      }).catch(() => { })

    fetch(`/api/platform/clubs/${slug}/webmaster-status`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setWebmasterActive(d.isActive ?? null))
      .catch(() => { })
  }, [slug])

  function flash(msg: string, error = false) {
    setMessage(msg); setIsError(error)
    setTimeout(() => setMessage(''), 3000)
  }

  async function updateStatus(status: string) {
    setSaving(true)
    const res = await fetch(`/api/platform/clubs/${slug}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    if (res.ok) { setClub(prev => prev ? { ...prev, status } : null); flash(`Status updated to ${status}`) }
    setSaving(false)
  }

  async function handleSaveBilling() {
    setSavingBilling(true)
    await fetch(`/api/platform/clubs/${slug}/billing`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discountType: discount.type, discountValue: parseFloat(discount.value) || 0,
        discountNote: discount.note || null, packageIds: selectedPkgs,
      })
    })
    const b: BillingData = await fetch(`/api/platform/clubs/${slug}/billing`, { cache: 'no-store' }).then(r => r.json())
    setBilling(b); setSavingBilling(false); flash('Billing saved')
  }

  async function handleResetPassword() {
    setResetModal(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch(`/api/platform/clubs/${slug}/reset-webmaster-password`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reset failed')
      setResetModal({ open: true, loading: false, tempPassword: data.tempPassword })
    } catch (err: unknown) {
      setResetModal({ open: false, loading: false, tempPassword: null })
      flash(err instanceof Error ? err.message : 'Password reset failed', true)
    }
  }

  async function handleToggleWebmaster() {
    if (webmasterActive === null) return
    setTogglingWebmaster(true)
    try {
      const res = await fetch(`/api/platform/clubs/${slug}/webmaster-status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !webmasterActive })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update account')
      setWebmasterActive(data.isActive)
      flash(`Webmaster account ${data.isActive ? 'enabled' : 'disabled'}`)
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Failed to update account', true)
    }
    setDisableModal(false)
    setTogglingWebmaster(false)
  }

  async function handleExtendGrace() {
    const days = parseInt(graceDays)
    if (!days || days < 1) return
    setSavingGrace(true)
    try {
      const res = await fetch(`/api/platform/clubs/${slug}/grace`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, note: graceNote || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to extend grace period')
      setGracePeriodEnds(data.gracePeriodEnds)
      setGraceModal(false)
      setGraceDays('7')
      setGraceNote('')
      flash(`Grace period extended by ${days} day${days === 1 ? '' : 's'}`)
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Failed to extend grace period', true)
    }
    setSavingGrace(false)
  }

  if (!club) return <div className="text-gray-400 text-sm p-8">Loading…</div>

  return (
    <div className="space-y-6">

      {/* Breadcrumb + header */}
      <div>
        <a href="/admin/clubs" className="text-sm text-gray-400 hover:text-gray-600">← Clubs</a>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{club.displayName}</h1>
            <div className="flex items-center gap-3 mt-1">
              <a href={`https://${club.slug}.membersguild.com.au`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#1a2744] font-mono hover:underline">
                {club.slug}.membersguild.com.au ↗
              </a>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColour(club.status)}`}>
                {club.status}
              </span>
            </div>
          </div>
          {club.onboardedAt && (
            <p className="text-xs text-gray-400">
              Onboarded {new Date(club.onboardedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Flash message */}
      {message && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${isError
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-green-50 border-green-200 text-green-700'}`}>
          {isError ? '✗' : '✓'} {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Members', value: `${club.memberCount} / ${club.tierCap}` },
          { label: 'Sessions', value: club.sessionCount },
          { label: 'Sport', value: club.sportType ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1 capitalize">{String(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Club Info + Webmaster */}
      <div className="grid grid-cols-2 gap-6">

        {/* Club Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Club Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Full Name</span>
              <span className="font-medium text-gray-900">{club.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Display Name</span>
              <span className="font-medium text-gray-900">{club.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sport</span>
              <span className="font-medium text-gray-900 capitalize">{club.sportType ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Website</span>
              {club.website
                ? <a href={club.website} target="_blank" rel="noopener noreferrer"
                  className="text-[#1a2744] hover:underline truncate max-w-[180px]">{club.website}</a>
                : <span className="text-gray-400">—</span>}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium text-gray-900">{club.phone ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Address</span>
              <span className="font-medium text-gray-900 text-right max-w-[180px]">{club.address ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Webmaster */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Webmaster</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{club.webmasterName ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              {club.webmasterEmail
                ? <a href={`mailto:${club.webmasterEmail}`}
                  className="text-[#1a2744] hover:underline">{club.webmasterEmail}</a>
                : <span className="text-gray-400">—</span>}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              {club.webmasterPhone
                ? <a href={`tel:${club.webmasterPhone}`}
                  className="text-[#1a2744] hover:underline">{club.webmasterPhone}</a>
                : <span className="text-gray-400">—</span>}
            </div>
          </div>

          {/* Webmaster controls */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Account Controls
            </p>
            <button
              onClick={() => setResetModal({ open: true, loading: false, tempPassword: null })}
              disabled={resetModal.loading}
              className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-[#1a2744] hover:text-[#1a2744] transition-colors flex items-center justify-between disabled:opacity-50">
              <span>🔑 Reset Password</span>
              {resetModal.loading && <span className="text-xs text-gray-400">Resetting…</span>}
            </button>
            <button
              onClick={() => setDisableModal(true)}
              disabled={togglingWebmaster || webmasterActive === null}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between disabled:opacity-50
                ${webmasterActive === false
                  ? 'border-green-200 text-green-700 hover:border-green-400'
                  : 'border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-600'
                }`}>
              <span>{webmasterActive === false ? '✅ Enable Account' : '🔒 Disable Account'}</span>
              {webmasterActive === null && <span className="text-xs text-gray-400">Loading…</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Subscription + Billing */}
      <div className="grid grid-cols-2 gap-6">

        {/* Subscription Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-900">Subscription Status</h3>
          <div className="space-y-2">
            {['active', 'suspended', 'cancelled'].map(s => (
              <button key={s} onClick={() => updateStatus(s)}
                disabled={saving || club.status === s}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors
                  ${club.status === s
                    ? 'bg-[#1a2744] text-white border-[#1a2744]'
                    : 'border-gray-200 text-gray-700 hover:border-[#1a2744] hover:text-[#1a2744]'
                  } disabled:opacity-50`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Grace period — next session */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Grace Period
            </p>
            {gracePeriodEnds && (
              <p className="text-xs text-amber-600 mb-2">
                ⏳ Ends {new Date(gracePeriodEnds).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            <button
              onClick={() => setGraceModal(true)}
              className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-[#1a2744] hover:text-[#1a2744] transition-colors flex items-center justify-between">
              <span>⏳ Extend Grace Period</span>
            </button>
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
                          p.includes(pkg.id) ? p.filter(x => x !== pkg.id) : [...p, pkg.id])}
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
                    <input type="number" min="0" max="100" value={discount.value}
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
        </div>'
        </div>

        {/* Danger Zone */}
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
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
            Deactivate Club
          </button>
        </div>

        {/* Reset Password Modal */}
        {resetModal.open && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Reset Webmaster Password</h2>

              {resetModal.tempPassword ? (
                <>
                  <p className="text-sm text-gray-600">
                    A new temporary password has been generated for{' '}
                    <span className="font-medium text-gray-900">{club.webmasterEmail}</span>.
                    Share this with them securely — it won&apos;t be shown again.
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-lg font-bold text-gray-900 tracking-widest text-center select-all">
                    {resetModal.tempPassword}
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Click the password to select it, then copy.
                  </p>
                  <button
                    onClick={() => setResetModal({ open: false, loading: false, tempPassword: null })}
                    className="w-full bg-[#1a2744] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e3460] transition-colors">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    This will generate a new temporary password for{' '}
                    <span className="font-medium text-gray-900">{club.webmasterEmail}</span>.
                    Their current password will be invalidated immediately.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setResetModal({ open: false, loading: false, tempPassword: null })}
                      className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:border-gray-400 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetModal.loading}
                      className="flex-1 bg-[#1a2744] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e3460] disabled:opacity-50 transition-colors">
                      {resetModal.loading ? 'Resetting…' : 'Reset Password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Disable / Enable Account Modal */}
        {disableModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">
                {webmasterActive ? 'Disable Webmaster Account' : 'Enable Webmaster Account'}
              </h2>
              <p className="text-sm text-gray-600">
                {webmasterActive
                  ? <>This will immediately block <span className="font-medium text-gray-900">{club.webmasterEmail}</span> from logging in. The account and all data are preserved.</>
                  : <>This will restore login access for <span className="font-medium text-gray-900">{club.webmasterEmail}</span>.</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDisableModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:border-gray-400 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleToggleWebmaster}
                  disabled={togglingWebmaster}
                  className={`flex-1 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors
                  ${webmasterActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                  {togglingWebmaster ? 'Updating…' : webmasterActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Extend Grace Period Modal */}
        {graceModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Extend Grace Period</h2>
              <p className="text-sm text-gray-600">
                Extends the grace period for <span className="font-medium text-gray-900">{club.displayName}</span>.
                If a grace period is already active, the days will be added on top.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Days to extend</label>
                <input
                  type="number" min="1" max="365" value={graceDays}
                  onChange={e => setGraceDays(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Note <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text" value={graceNote}
                  onChange={e => setGraceNote(e.target.value)}
                  placeholder="e.g. Payment issue — gave 14 days to sort"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setGraceModal(false); setGraceDays('7'); setGraceNote('') }}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:border-gray-400 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleExtendGrace}
                  disabled={savingGrace || !graceDays || parseInt(graceDays) < 1}
                  className="flex-1 bg-[#1a2744] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e3460] disabled:opacity-50 transition-colors">
                  {savingGrace ? 'Saving…' : 'Extend'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    
  )
}