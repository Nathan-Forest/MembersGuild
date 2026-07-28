'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceRow {
  date: string; sessionTitle: string; startTime: string; endTime: string
  location: string | null; pool: string | null; lanes: number | null; coach: string | null
  attendeeName: string; attendeeType: string; status: string | null; notes: string | null
}

interface MembershipRow {
  firstName: string; lastName: string; email: string; phone: string | null
  role: string; isActive: boolean; memberNumber: string | null; associationNumber: string | null
  dateOfBirth: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null
  marketingOptOut: boolean; creditBalance: number; memberSince: string
}

interface CreditHistoryRow {
  date: string; memberName: string; memberEmail: string; transactionType: string
  amount: number; balanceAfter: number; notes: string | null; addedBy: string
}

type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom'

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week', month: 'This Month',
  quarter: 'This Quarter', year: 'This Year', custom: 'Custom'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodDates(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date()
  if (period === 'custom') return { start: customStart ?? '', end: customEnd ?? '' }

  let start: Date, end: Date
  if (period === 'week') {
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0)
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999)
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    start = new Date(now.getFullYear(), q * 3, 1)
    end = new Date(now.getFullYear(), q * 3 + 3, 0)
  } else {
    start = new Date(now.getFullYear(), 0, 1)
    end = new Date(now.getFullYear(), 11, 31)
  }
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BackupsPage() {
  const router = useRouter()
  const user = getCurrentUser()

  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [exportingAttendance, setExportingAttendance] = useState(false)
  const [exportingMembership, setExportingMembership] = useState(false)
  const [exportingCreditHistory, setExportingCreditHistory] = useState(false)

  useEffect(() => {
    if (user && !hasPermission(user, 'committee', 'membership', 'finance', 'webmaster')) {
      router.replace('/dashboard')
    }
  }, [])

  const { start, end } = getPeriodDates(period, customStart, customEnd)

  async function handleAttendanceExport() {
    if (!start || !end) return
    setExportingAttendance(true)
    try {
      const rows = await api.get<AttendanceRow[]>(`/backups/attendance?start=${start}&end=${end}`)
      if (rows.length === 0) { alert('No attendance data in this period.'); return }
      downloadCsv(
        `attendance-backup-${start}-${end}`,
        ['Date', 'Session', 'Start Time', 'End Time', 'Location', 'Pool', 'Lanes', 'Coach', 'Attendee', 'Type', 'Status', 'Notes'],
        rows.map(r => [
          fmtDate(r.date), r.sessionTitle,
          new Date(r.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
          new Date(r.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
          r.location ?? '', r.pool ?? '', r.lanes ?? '', r.coach ?? '',
          r.attendeeName, r.attendeeType, r.status ?? '', r.notes ?? ''
        ])
      )
    } catch { alert('Failed to export attendance data') }
    finally { setExportingAttendance(false) }
  }

  async function handleMembershipExport() {
    setExportingMembership(true)
    try {
      const rows = await api.get<MembershipRow[]>('/backups/membership')
      if (rows.length === 0) { alert('No members found.'); return }
      downloadCsv(
        `membership-backup-${new Date().toISOString().split('T')[0]}`,
        ['First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Status', 'Member No.', 'Association No.',
         'Date of Birth', 'Emergency Contact', 'Emergency Phone', 'Marketing Opt Out', 'Credit Balance', 'Member Since'],
        rows.map(r => [
          r.firstName, r.lastName, r.email, r.phone ?? '', r.role, r.isActive ? 'Active' : 'Inactive',
          r.memberNumber ?? '', r.associationNumber ?? '',
          r.dateOfBirth ? fmtDate(r.dateOfBirth) : '', r.emergencyContactName ?? '', r.emergencyContactPhone ?? '',
          r.marketingOptOut ? 'Yes' : 'No', r.creditBalance, fmtDate(r.memberSince)
        ])
      )
    } catch { alert('Failed to export membership data') }
    finally { setExportingMembership(false) }
  }

  async function handleCreditHistoryExport() {
    if (!start || !end) return
    setExportingCreditHistory(true)
    try {
      const rows = await api.get<CreditHistoryRow[]>(`/backups/credit-history?start=${start}&end=${end}`)
      if (rows.length === 0) { alert('No credit transactions in this period.'); return }
      downloadCsv(
        `credit-history-backup-${start}-${end}`,
        ['Date', 'Member', 'Email', 'Type', 'Amount', 'Balance After', 'Notes', 'Added By'],
        rows.map(r => [
          new Date(r.date).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          r.memberName, r.memberEmail, r.transactionType, r.amount, r.balanceAfter, r.notes ?? '', r.addedBy
        ])
      )
    } catch { alert('Failed to export credit history') }
    finally { setExportingCreditHistory(false) }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Backups &amp; Exports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Download full data exports for record-keeping and business continuity.
        </p>
      </div>

      {/* Period selector — applies to Attendance and Credit History exports */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Time Period</p>
        <p className="text-xs text-gray-400">Applies to Attendance and Credit History exports below</p>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={period === p ? { backgroundColor: 'var(--color-primary)' } : {}}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input text-sm" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input text-sm" />
          </div>
        ) : (
          <p className="text-xs text-gray-400">{start && end ? `${fmtDate(start)} — ${fmtDate(end)}` : ''}</p>
        )}
      </div>

      {/* Attendance Export */}
      <div className="card p-6 space-y-3">
        <h3 className="font-semibold text-gray-900">Attendance Export</h3>
        <p className="text-sm text-gray-500">
          Every attendee for every session in the selected period — name, date, time, location, pool, lanes, coach, status and notes.
        </p>
        <button onClick={handleAttendanceExport} disabled={exportingAttendance} className="btn-primary text-sm px-4 py-2">
          {exportingAttendance ? 'Exporting…' : '↓ Export Attendance CSV'}
        </button>
      </div>

      {/* Membership Export */}
      <div className="card p-6 space-y-3">
        <h3 className="font-semibold text-gray-900">Membership Export</h3>
        <p className="text-sm text-gray-500">
          Full member roster — contact details, role, status, emergency contact, marketing preference, and current credit balance.
        </p>
        <button onClick={handleMembershipExport} disabled={exportingMembership} className="btn-primary text-sm px-4 py-2">
          {exportingMembership ? 'Exporting…' : '↓ Export Membership CSV'}
        </button>
      </div>

      {/* Credit History Export */}
      <div className="card p-6 space-y-3">
        <h3 className="font-semibold text-gray-900">Credit History Export</h3>
        <p className="text-sm text-gray-500">
          Every credit transaction in the selected period — who it was for, the amount, running balance, and who made the change.
        </p>
        <button onClick={handleCreditHistoryExport} disabled={exportingCreditHistory} className="btn-primary text-sm px-4 py-2">
          {exportingCreditHistory ? 'Exporting…' : '↓ Export Credit History CSV'}
        </button>
      </div>
    </div>
  )
}