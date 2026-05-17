'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { MemberListResponse, MemberDetailResponse, MemberStatsResponse } from '@/types'
import { ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImportRow {
  firstName: string
  lastName: string
  email: string
  phone: string
  joinDate: string
  associationNumber: string
  startingCredits: number
  role: string
  errors: string[]
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

type ModalTab = 'details' | 'emergency' | 'credits' | 'role'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ['cats', 'member', 'coach', 'committee', 'membership', 'finance', 'webmaster']

const CREDIT_FILTERS = [
  { value: '', label: 'All Members' },
  { value: 'none', label: 'No Credits' },
  { value: 'low', label: 'Low Credits (1-2)' },
  { value: 'ok', label: 'Has Credits' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVisibleTabs(role: UserRole | null): { key: ModalTab; label: string }[] {
  const all: { key: ModalTab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'emergency', label: 'Emergency Contact' },
    { key: 'credits', label: 'Credits' },
    { key: 'role', label: 'Role & Access' },
  ]
  if (role === 'webmaster') return all
  if (role === 'finance') return all.filter(t => t.key !== 'role')
  if (role === 'membership') return all.filter(t => t.key !== 'credits')
  return all.filter(t => t.key === 'details' || t.key === 'emergency')
}

function roleBadgeClass(role: string) {
  switch (role) {
    case 'webmaster':  return 'bg-purple-100 text-purple-800'
    case 'coach':      return 'bg-blue-100 text-blue-800'
    case 'finance':    return 'bg-green-100 text-green-800'
    case 'membership': return 'bg-indigo-100 text-indigo-800'
    case 'committee':  return 'bg-cyan-100 text-cyan-800'
    case 'cats':       return 'bg-amber-100 text-amber-800'
    default:           return 'bg-gray-100 text-gray-700'
  }
}

function creditClass(balance: number) {
  if (balance <= 0) return 'text-red-600 font-bold'
  if (balance <= 2) return 'text-amber-600 font-semibold'
  return 'text-green-700 font-semibold'
}

function downloadTemplate() {
  const rows = [
    ['First Name', 'Last Name', 'Email', 'Phone', 'Join Date (DD/MM/YYYY)', 'Association Number', 'Starting Credits', 'Role'],
    ['Sarah', 'Wade', 'sarah.wade@email.com', '0412345678', '01/03/2019', 'MSA10001', '10', 'member'],
    ['Tom', 'Hunter', 'tom.hunter@email.com', '0423456789', '15/06/2021', 'MSA10002', '5', 'member'],
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'members-import-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let current = ''
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += char }
  }
  result.push(current.trim())
  return result
}

function validateRow(row: ImportRow): string[] {
  const errs: string[] = []
  if (!row.firstName) errs.push('First name required')
  if (!row.lastName)  errs.push('Last name required')
  if (!row.email)     errs.push('Email required')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errs.push('Invalid email')
  if (row.joinDate && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row.joinDate))
    errs.push('Date must be DD/MM/YYYY')
  if (isNaN(row.startingCredits) || row.startingCredits < 0)
    errs.push('Credits must be 0 or more')
  return errs
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const router = useRouter()

  // Core
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [members, setMembers]         = useState<MemberListResponse[]>([])
  const [stats, setStats]             = useState<MemberStatsResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [assocLabel, setAssocLabel]   = useState('Association Number')

  // Search / filter
  const [search, setSearch]           = useState('')
  const [creditFilter, setCreditFilter] = useState('')

  // Member detail modal
  const [selected, setSelected]       = useState<MemberDetailResponse | null>(null)
  const [modalOpen, setModalOpen]     = useState(false)
  const [modalTab, setModalTab]       = useState<ModalTab>('details')
  const [joinedAtEdit, setJoinedAtEdit]     = useState('')
  const [assocNumberEdit, setAssocNumberEdit] = useState('')

  // Add member modal
  const [addModalOpen, setAddModalOpen]         = useState(false)
  const [addForm, setAddForm]                   = useState({
    firstName: '', lastName: '', email: '', phone: '', role: 'member', memberNumber: '',
  })
  const [addLoading, setAddLoading]             = useState(false)
  const [addError, setAddError]                 = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState<string | null>(null)

  // Import CSV modal
  const [importOpen, setImportOpen]     = useState(false)
  const [importStep, setImportStep]     = useState<'upload' | 'preview' | 'done'>('upload')
  const [importRows, setImportRows]     = useState<ImportRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting]       = useState(false)
  const [importError, setImportError]   = useState('')

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentRole(user.role as UserRole)
    loadData()
  }, [router])

  useEffect(() => {
    const timer = setTimeout(loadFiltered, 300)
    return () => clearTimeout(timer)
  }, [search, creditFilter])

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadData() {
    setLoading(true)
    try {
      const [membersData, statsData] = await Promise.all([
        api.get<MemberListResponse[]>('/members'),
        api.get<MemberStatsResponse>('/members/stats'),
      ])
      setMembers(membersData)
      setStats(statsData)
      api.get<{ associationNumberLabel: string }>('/settings/labels')
        .then(d => setAssocLabel(d.associationNumberLabel))
        .catch(() => {})
    } catch {
    } finally {
      setLoading(false)
    }
  }

  async function loadFiltered() {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (creditFilter) params.set('credits', creditFilter)
    try {
      const data = await api.get<MemberListResponse[]>(`/members?${params}`)
      setMembers(data)
    } catch { }
  }

  async function openMember(id: number) {
    try {
      const detail = await api.get<MemberDetailResponse>(`/members/${id}`)
      setSelected(detail)
      setAssocNumberEdit(detail.associationNumber ?? '')
      setJoinedAtEdit(detail.joinedAt ? new Date(detail.joinedAt).toISOString().split('T')[0] : '')
      setModalTab('details')
      setModalOpen(true)
    } catch { }
  }

  // ── Member actions ─────────────────────────────────────────────────────────

  async function handleRoleChange(id: number, role: string) {
    try {
      await api.put(`/members/${id}/role`, { role })
      await loadData()
      if (selected) setSelected({ ...selected, role })
    } catch { }
  }

  async function handleToggleActive(id: number, current: boolean) {
    try {
      await api.put(`/members/${id}/active`, !current)
      await loadData()
      if (selected) setSelected({ ...selected, isActive: !current })
    } catch { }
  }

  async function handleResetPassword(id: number) {
    if (!confirm("Reset this member's password? A temporary password will be generated.")) return
    try {
      const result = await api.post<{ temporaryPassword: string }>(`/members/${id}/reset-password`, {})
      alert(`Temporary password: ${result.temporaryPassword}\n\nShare this with the member securely.`)
    } catch { }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
    if (!confirm(`Are you sure? All data for ${name} will be deleted forever.`)) return
    try {
      await api.delete(`/members/${id}`)
      setModalOpen(false)
      setSelected(null)
      await loadData()
    } catch { }
  }

  async function handleSaveDetails() {
    if (!selected) return
    try {
      const detail = await api.put<MemberDetailResponse>(`/members/${selected.id}`, {
        firstName:             selected.firstName,
        lastName:              selected.lastName,
        phone:                 selected.phone,
        memberNumber:          selected.memberNumber,
        dateOfBirth:           selected.dateOfBirth,
        emergencyContactName:  selected.emergencyContactName,
        emergencyContactPhone: selected.emergencyContactPhone,
        joinedAt:              joinedAtEdit ? new Date(joinedAtEdit).toISOString() : null,
        associationNumber:     assocNumberEdit || null,
      })
      setSelected(detail)
    } catch { }
  }

  // ── Add member ─────────────────────────────────────────────────────────────

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      const result = await api.post<{ generatedPassword?: string } & MemberDetailResponse>('/members', {
        firstName:    addForm.firstName,
        lastName:     addForm.lastName,
        email:        addForm.email,
        phone:        addForm.phone || null,
        role:         addForm.role,
        memberNumber: addForm.memberNumber || null,
      })
      setNewMemberPassword(result.generatedPassword ?? null)
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', role: 'member', memberNumber: '' })
      await loadData()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create member')
    } finally {
      setAddLoading(false)
    }
  }

  // ── CSV import ─────────────────────────────────────────────────────────────

  function openImport() {
    setImportOpen(true)
    setImportStep('upload')
    setImportRows([])
    setImportResult(null)
    setImportError('')
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setImportError('File is empty or has no data rows'); return }

      const rows: ImportRow[] = lines.slice(1).map(line => {
        const cols = parseCsvLine(line)
        const credits = parseInt(cols[6] ?? '0')
        const row: ImportRow = {
          firstName:         cols[0] ?? '',
          lastName:          cols[1] ?? '',
          email:             cols[2] ?? '',
          phone:             cols[3] ?? '',
          joinDate:          cols[4] ?? '',
          associationNumber: cols[5] ?? '',
          startingCredits:   isNaN(credits) ? 0 : credits,
          role:              (cols[7] ?? 'member').toLowerCase().trim() || 'member',
          errors:            [],
        }
        row.errors = validateRow(row)
        return row
      }).filter(r => r.firstName || r.lastName || r.email)

      setImportRows(rows)
      setImportStep('preview')
      setImportError('')
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    const validRows = importRows.filter(r => r.errors.length === 0)
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const result = await api.post<ImportResult>('/members/import', validRows.map(r => ({
        firstName:         r.firstName,
        lastName:          r.lastName,
        email:             r.email,
        phone:             r.phone || null,
        joinDate:          r.joinDate || null,
        associationNumber: r.associationNumber || null,
        startingCredits:   r.startingCredits,
        role:              r.role,
      })))
      setImportResult(result)
      setImportStep('done')
      await loadData()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const canManage       = currentRole === 'membership' || currentRole === 'webmaster'
  const canManageCredits = currentRole === 'finance' || currentRole === 'webmaster'
  const isWebmaster     = currentRole === 'webmaster'
  const validImportRows = importRows.filter(r => r.errors.length === 0).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Members</h1>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={openImport} className="btn-secondary px-4 py-2">
              ↑ Import CSV
            </button>
            <button
              onClick={() => { setAddModalOpen(true); setNewMemberPassword(null); setAddError('') }}
              className="btn-primary px-4 py-2"
            >
              + Add Member
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Members" value={stats.totalMembers}    color="blue"  />
          <StatCard label="Active"        value={stats.activeMembers}   color="green" />
          <StatCard label="Low Credits"   value={stats.lowCreditMembers} color="amber" />
          <StatCard label="No Credits"    value={stats.noCreditsMembers} color="red"   />
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by name, email or member number…"
            className="input pl-10" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-52" value={creditFilter}
          onChange={e => setCreditFilter(e.target.value)}>
          {CREDIT_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Members table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Credits</th>
              <th>Upcoming</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading members…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No members found</td></tr>
            ) : members.map(m => (
              <tr key={m.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: 'var(--color-primary)' }}>
                      {m.firstName.charAt(0)}{m.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{m.fullName}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${roleBadgeClass(m.role)}`}>{m.roleLabel}</span></td>
                <td><span className={creditClass(m.creditBalance)}>{m.creditBalance}</span></td>
                <td className="text-gray-600">{m.upcomingSessionCount}</td>
                <td className="text-gray-600">{m.phone ?? '—'}</td>
                <td>
                  <span className={`badge ${m.isActive ? 'badge-green' : 'badge-gray'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button onClick={() => openMember(m.id)}
                    className="text-xs font-medium hover:underline"
                    style={{ color: 'var(--color-primary)' }}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-right">
        {members.length} member{members.length !== 1 ? 's' : ''} shown
      </p>

      {/* ── Member detail modal ────────────────────────────────────────────── */}
      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {selected.firstName.charAt(0)}{selected.lastName.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selected.firstName} {selected.lastName}</h2>
                  <span className={`badge text-xs ${roleBadgeClass(selected.role)}`}>
                    {ROLE_LABELS[selected.role as UserRole]}
                  </span>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {getVisibleTabs(currentRole).map(tab => (
                <button key={tab.key} onClick={() => setModalTab(tab.key)}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${
                    modalTab === tab.key
                      ? 'border-b-2 text-[var(--color-primary)]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={modalTab === tab.key ? { borderColor: 'var(--color-primary)' } : {}}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">

              {/* Details tab */}
              {modalTab === 'details' && (
                <div className="space-y-4">
                  <dl className="space-y-0 divide-y divide-gray-100">
                    <ModalRow label="Email"      value={selected.email} />
                    <ModalRow label="Phone"      value={selected.phone ?? '—'} />
                    <ModalRow label="Member No." value={selected.memberNumber ? `#${selected.memberNumber}` : '—'} />
                    {selected.associationNumber && (
                      <ModalRow label={assocLabel} value={selected.associationNumber} />
                    )}
                    <ModalRow label="Status"  value={selected.isActive ? 'Active' : 'Inactive'} />
                    <ModalRow label="Credits" value={String(selected.creditBalance)} />
                    <ModalRow label="Member Since" value={
                      new Date(selected.effectiveJoinDate ?? selected.createdAt).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })
                    } />
                    {selected.dateOfBirth && (
                      <ModalRow label="Date of Birth" value={
                        new Date(selected.dateOfBirth as unknown as string).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })
                      } />
                    )}
                    {selected.lastLoginAt && (
                      <ModalRow label="Last Login" value={
                        new Date(selected.lastLoginAt).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })
                      } />
                    )}
                  </dl>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleToggleActive(selected.id, selected.isActive)}
                        className={selected.isActive ? 'btn-secondary text-xs px-3 py-1.5' : 'btn-primary text-xs px-3 py-1.5'}>
                        {selected.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {isWebmaster && (
                        <>
                          <button onClick={() => handleResetPassword(selected.id)}
                            className="btn-secondary text-xs px-3 py-1.5">
                            Reset Password
                          </button>
                          <button onClick={() => handleDelete(selected.id, selected.firstName)}
                            className="btn-danger text-xs px-3 py-1.5">
                            Delete Member
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Editable fields — Membership/Webmaster */}
                  {canManage && (
                    <div className="pt-3 border-t border-gray-100 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{assocLabel}</label>
                        <div className="flex gap-2">
                          <input type="text" className="input text-sm flex-1" placeholder="Optional"
                            value={assocNumberEdit}
                            onChange={e => setAssocNumberEdit(e.target.value)} />
                          <button onClick={handleSaveDetails} className="btn-secondary text-xs px-3">
                            Save
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Actual Join Date</label>
                        <div className="flex gap-2">
                          <input type="date" className="input text-sm flex-1"
                            value={joinedAtEdit}
                            onChange={e => setJoinedAtEdit(e.target.value)} />
                          <button onClick={handleSaveDetails} className="btn-secondary text-xs px-3">
                            Save
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Leave blank to use system entry date</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Emergency contact tab */}
              {modalTab === 'emergency' && (
                <div className="space-y-4">
                  {(selected.emergencyContactName || selected.emergencyContactPhone) ? (
                    <>
                      <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
                        <span className="text-red-500 text-lg mt-0.5">🚨</span>
                        <div>
                          <p className="text-sm font-semibold text-red-800">Emergency Contact</p>
                          <p className="text-xs text-red-600 mt-0.5">For use in medical emergencies only</p>
                        </div>
                      </div>
                      <dl className="space-y-0 divide-y divide-gray-100">
                        <ModalRow label="Name"  value={selected.emergencyContactName ?? '—'} />
                        <ModalRow label="Phone" value={selected.emergencyContactPhone ?? '—'} />
                      </dl>
                      {selected.emergencyContactPhone && (
                        <a href={`tel:${selected.emergencyContactPhone}`}
                          className="btn-primary w-full py-2.5 text-center block text-sm">
                          📞 Call {selected.emergencyContactName ?? 'Emergency Contact'}
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 text-center">
                      <p className="text-2xl mb-2">⚠️</p>
                      <p className="text-sm font-semibold text-amber-800">No emergency contact on file</p>
                      <p className="text-xs text-amber-600 mt-1">Ask {selected.firstName} to update their profile</p>
                    </div>
                  )}
                </div>
              )}

              {/* Credits tab */}
              {modalTab === 'credits' && (
                <div className="space-y-4">
                  <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                    <p className="text-white text-sm opacity-80">Current Balance</p>
                    <p className="text-white text-4xl font-bold mt-1">{selected.creditBalance}</p>
                    <p className="text-white text-sm opacity-70 mt-1">credits</p>
                  </div>
                  {canManageCredits && (
                    <CreditAdjustForm memberId={selected.id} onAdjusted={async () => {
                      await loadData()
                      const detail = await api.get<MemberDetailResponse>(`/members/${selected.id}`)
                      setSelected(detail)
                    }} />
                  )}
                </div>
              )}

              {/* Role tab */}
              {modalTab === 'role' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Current role:{' '}
                    <span className="font-semibold text-gray-900">
                      {ROLE_LABELS[selected.role as UserRole]}
                    </span>
                  </p>
                  {canManage ? (
                    <div className="space-y-2">
                      <label className="label">Change role</label>
                      <select className="input" value={selected.role}
                        onChange={e => handleRoleChange(selected.id, e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <p className="text-xs text-gray-400">Role changes take effect immediately.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">You don&apos;t have permission to change roles.</p>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Add Member modal ───────────────────────────────────────────────── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Add New Member</h2>
              <button onClick={() => { setAddModalOpen(false); setNewMemberPassword(null) }}
                className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {newMemberPassword ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                    <p className="text-sm font-semibold text-green-800 mb-1">Member created successfully</p>
                    <p className="text-xs text-green-600">Share this temporary password securely</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
                      Temporary Password — shown once only
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-lg font-mono font-bold text-amber-900 bg-amber-100 px-3 py-2 rounded-lg">
                        {newMemberPassword}
                      </code>
                      <button onClick={() => navigator.clipboard.writeText(newMemberPassword)}
                        className="btn-secondary text-xs px-3 py-2 flex-shrink-0">
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setNewMemberPassword(null)
                        setAddForm({ firstName: '', lastName: '', email: '', phone: '', role: 'member', memberNumber: '' })
                      }}
                      className="btn-primary flex-1 py-2">
                      Add Another
                    </button>
                    <button onClick={() => { setAddModalOpen(false); setNewMemberPassword(null) }}
                      className="btn-secondary flex-1 py-2">
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddMember} className="space-y-4">
                  {addError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {addError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">First name <span className="text-red-500">*</span></label>
                      <input type="text" required className="input" value={addForm.firstName}
                        onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Last name <span className="text-red-500">*</span></label>
                      <input type="text" required className="input" value={addForm.lastName}
                        onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email <span className="text-red-500">*</span></label>
                    <input type="email" required className="input" value={addForm.email}
                      onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Phone</label>
                      <input type="tel" className="input" value={addForm.phone}
                        onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Member No.</label>
                      <input type="text" className="input" placeholder="Optional" value={addForm.memberNumber}
                        onChange={e => setAddForm(f => ({ ...f, memberNumber: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Role <span className="text-red-500">*</span></label>
                    <select className="input" value={addForm.role}
                      onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400">
                    A temporary password will be auto-generated and shown once after creation.
                  </p>
                  <button type="submit" disabled={addLoading} className="btn-primary w-full py-2.5">
                    {addLoading ? 'Creating…' : 'Create Member'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import CSV modal ───────────────────────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">Import Members from CSV</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {importStep === 'upload'  && 'Upload a CSV file to bulk-add members'}
                  {importStep === 'preview' && `${importRows.length} rows found — review before importing`}
                  {importStep === 'done'    && 'Import complete'}
                </p>
              </div>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6">

              {/* Step 1 — Upload */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <p className="text-3xl mb-3">📄</p>
                    <p className="text-sm font-medium text-gray-700 mb-1">Upload your CSV file</p>
                    <p className="text-xs text-gray-400 mb-4">
                      Columns: First Name, Last Name, Email, Phone, Join Date, {assocLabel}, Starting Credits, Role
                    </p>
                    <input type="file" accept=".csv" onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    {importError && <p className="text-xs text-red-500 mt-3">{importError}</p>}
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">Not sure of the format?</p>
                      <p className="text-xs text-gray-400 mt-0.5">Download the template with example data filled in</p>
                    </div>
                    <button onClick={downloadTemplate} className="btn-secondary text-sm px-4 py-2 flex-shrink-0">
                      ↓ Download Template
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Preview */}
              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">{validImportRows}</p>
                      <p className="text-xs text-green-600 mt-0.5">Ready to import</p>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                      <p className="text-2xl font-bold text-red-700">
                        {importRows.filter(r => r.errors.length > 0).length}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">Rows with errors</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">{importRows.length}</p>
                      <p className="text-xs text-blue-600 mt-0.5">Total rows</p>
                    </div>
                  </div>

                  {importRows.some(r => r.errors.length > 0) && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                      ⚠️ Rows with errors will be skipped. Fix the CSV and re-upload, or proceed to import valid rows only.
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Phone</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Join Date</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Credits</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importRows.map((row, i) => (
                          <tr key={i} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2">
                              {row.errors.length > 0 ? (
                                <span title={row.errors.join(', ')} className="text-red-500 cursor-help">
                                  ✕ {row.errors[0]}
                                </span>
                              ) : (
                                <span className="text-green-600">✓</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">{row.firstName} {row.lastName}</td>
                            <td className="px-3 py-2 text-gray-600">{row.email}</td>
                            <td className="px-3 py-2 text-gray-600">{row.phone || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.joinDate || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.startingCredits}</td>
                            <td className="px-3 py-2">
                              <span className={`badge text-xs ${roleBadgeClass(row.role)}`}>
                                {ROLE_LABELS[row.role as UserRole] ?? row.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 3 — Done */}
              {importStep === 'done' && importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
                      <p className="text-3xl font-bold text-green-700">{importResult.imported}</p>
                      <p className="text-xs text-green-600 mt-1">✓ Imported</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-center">
                      <p className="text-3xl font-bold text-amber-700">{importResult.skipped}</p>
                      <p className="text-xs text-amber-600 mt-1">⚠ Skipped</p>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                      <p className="text-3xl font-bold text-red-700">{importResult.errors.length}</p>
                      <p className="text-xs text-red-600 mt-1">✕ Errors</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="rounded-xl border border-red-100 overflow-hidden">
                      <div className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
                        Errors / Skipped
                      </div>
                      <ul className="divide-y divide-red-50 max-h-48 overflow-y-auto">
                        {importResult.errors.map((e, i) => (
                          <li key={i} className="px-4 py-2 text-xs text-red-600">{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 text-center">
                    All imported members have been assigned auto-generated passwords.
                    Use Reset Password in the member modal to share credentials.
                  </p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex justify-between gap-3 p-6 border-t border-gray-100 flex-shrink-0">
              {importStep === 'upload' && (
                <button onClick={() => setImportOpen(false)} className="btn-secondary px-4 py-2 text-sm ml-auto">
                  Cancel
                </button>
              )}
              {importStep === 'preview' && (
                <>
                  <button onClick={() => setImportStep('upload')} className="btn-secondary px-4 py-2 text-sm">
                    ← Back
                  </button>
                  <button onClick={handleImport} disabled={importing || validImportRows === 0}
                    className="btn-primary px-6 py-2 text-sm">
                    {importing ? 'Importing…' : `Import ${validImportRows} Member${validImportRows !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
              {importStep === 'done' && (
                <button onClick={() => setImportOpen(false)} className="btn-primary px-6 py-2 text-sm ml-auto">
                  Done
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: {
  label: string; value: number; color: 'blue' | 'green' | 'amber' | 'red'
}) {
  const colors = {
    blue:  'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red:   'bg-red-50 text-red-700 border-red-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <dt className="w-28 text-sm text-gray-500 flex-shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

function CreditAdjustForm({ memberId, onAdjusted }: {
  memberId: number; onAdjusted: () => void
}) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const n = parseInt(amount)
    if (isNaN(n) || n === 0) { setError('Enter a non-zero amount'); return }
    if (!notes.trim()) { setError('Notes are required'); return }
    setSaving(true)
    try {
      await api.post('/credits/adjust', { userId: memberId, amount: n, notes })
      setAmount('')
      setNotes('')
      onAdjusted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust credits')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 pt-4">
      <p className="text-sm font-medium text-gray-700">Adjust Credits</p>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      <div>
        <label className="label text-xs">
          Amount <span className="text-gray-400">(positive to add, negative to remove)</span>
        </label>
        <input type="number" className="input" placeholder="e.g. 10 or -1"
          value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label text-xs">Notes <span className="text-red-500">*</span></label>
        <input type="text" className="input"
          placeholder="e.g. Payment received for 10-credit pack"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full py-2">
        {saving ? 'Saving…' : 'Apply adjustment'}
      </button>
    </form>
  )
}
