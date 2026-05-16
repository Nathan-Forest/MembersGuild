'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancialReport {
  totalRevenue: number; confirmedRevenue: number; pendingRevenue: number
  totalOrders: number; pendingOrders: number; confirmedOrders: number
  deliveredOrders: number; cancelledOrders: number
  creditPackRevenue: number; merchandiseRevenue: number; totalCreditsIssued: number
  topItems: { name: string; quantitySold: number; revenue: number }[]
}

interface MembershipReport {
  totalMembers: number; activeMembers: number; inactiveMembers: number
  newMembersInPeriod: number
  roleBreakdown: { role: string; label: string; count: number }[]
  newMembersList: { id: number; name: string; email: string; role: string; createdAt: string }[]
}

interface CatsReport {
  totalActiveCats: number; newCatsInPeriod: number
  convertedAllTime: number; conversionRateAllTime: number
  newCatsList: { id: number; name: string; email: string; creditBalance: number; createdAt: string }[]
  activeCatsList: { id: number; name: string; email: string; creditBalance: number; createdAt: string }[]
}

interface AttendanceReport {
  totalSessions: number; totalRegistrations: number; totalAttended: number
  averageAttendance: number; attendanceRate: number
  statusAttended: number; statusAbsent: number; statusLate: number
  statusNsba: number; statusNoShow: number
  sessions: {
    id: number; title: string; startTime: string; location?: string; coachName?: string
    registered: number; attended: number; absent: number; late: number; nsba: number; noShow: number
  }[]
}

interface LanesReport {
  overallAvgLanes: number; overallAvgAttendees: number; sessionsWithLaneData: number
  byDayOfWeek: { day: string; sessionCount: number; avgLanes: number; avgAttendees: number }[]
  sessions: { date: string; dayOfWeek: string; title: string; lanes?: number; attended: number }[]
}

interface CoachesReport {
  totalSessions: number
  coaches: { userId: number; name: string; sessionsAssigned: number; sessionsCompleted: number; sessionsCancelled: number }[]
}

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Period helpers ────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom'

function getPeriodDates(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date()

  if (period === 'custom') {
    return { start: customStart ?? '', end: customEnd ?? '' }
  }

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

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week', month: 'This Month',
  quarter: 'This Quarter', year: 'This Year', custom: 'Custom'
}

const TABS = [
  { key: 'financial', label: '💰 Financial' },
  { key: 'membership', label: '👥 Membership' },
  { key: 'cats', label: '🏊 CATS' },
  { key: 'attendance', label: '📊 Attendance' },
  { key: 'lanes', label: '🏊 Lanes' },
  { key: 'coaches', label: '🏋️ Coaches' },
]

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'gray' }: {
  label: string; value: string | number; sub?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    green: 'bg-green-50 border-green-100 text-green-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
    red: 'bg-red-50 border-red-100 text-red-900',
    purple: 'bg-purple-50 border-purple-100 text-purple-900',
    gray: 'bg-gray-50 border-gray-100 text-gray-900',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

function Table({ headers, rows, empty = 'No data' }: {
  headers: string[]
  rows: (string | number | React.ReactNode)[][]
  empty?: string
}) {
  if (rows.length === 0) return (
    <p className="text-sm text-gray-400 text-center py-8">{empty}</p>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map(h => (
              <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-4 text-gray-800 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const user = getCurrentUser()
  const router = useRouter()

  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [activeTab, setActiveTab] = useState('financial')
  const [loading, setLoading] = useState(false)

  const [financial, setFinancial] = useState<FinancialReport | null>(null)
  const [membership, setMembership] = useState<MembershipReport | null>(null)
  const [cats, setCats] = useState<CatsReport | null>(null)
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null)
  const [lanes, setLanes] = useState<LanesReport | null>(null)
  const [coaches, setCoaches] = useState<CoachesReport | null>(null)

  const allowedRoles = ['committee', 'membership', 'finance', 'webmaster', 'coach']
  useEffect(() => {
    if (user && !allowedRoles.includes(user.role)) router.replace('/dashboard')
  }, [])

  const { start, end } = getPeriodDates(period, customStart, customEnd)

  const load = useCallback(async () => {
    if (!start || !end) return
    setLoading(true)
    const params = `?start=${start}&end=${end}`
    try {
      switch (activeTab) {
        case 'financial': setFinancial(await api.get(`/reports/financial${params}`)); break
        case 'membership': setMembership(await api.get(`/reports/membership${params}`)); break
        case 'cats': setCats(await api.get(`/reports/cats${params}`)); break
        case 'attendance': setAttendance(await api.get(`/reports/attendance${params}`)); break
        case 'lanes': setLanes(await api.get(`/reports/lanes${params}`)); break
        case 'coaches': setCoaches(await api.get(`/reports/coaches${params}`)); break
      }
    } catch (err) {
      console.error('Report failed:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, start, end])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button onClick={load} disabled={loading}
          className="btn-secondary text-sm px-3 py-1.5">
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Period selector */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              style={period === p ? { backgroundColor: 'var(--color-primary)' } : {}}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="input text-sm" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="input text-sm" />
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            {start && end ? `${fmtDate(start)} — ${fmtDate(end)}` : ''}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100" />)}
          </div>
          <div className="h-48 rounded-xl bg-gray-100" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── Financial ──────────────────────────────────────────────────── */}
          {activeTab === 'financial' && financial && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Confirmed Revenue" value={`$${financial.confirmedRevenue.toFixed(2)}`} color="green" />
                <StatCard label="Pending Revenue" value={`$${financial.pendingRevenue.toFixed(2)}`} color="amber" />
                <StatCard label="Credits Issued" value={financial.totalCreditsIssued} color="blue" />
                <StatCard label="Total Orders" value={financial.totalOrders} color="gray" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Pending" value={financial.pendingOrders} />
                <StatCard label="Confirmed" value={financial.confirmedOrders} color="blue" />
                <StatCard label="Delivered" value={financial.deliveredOrders} color="green" />
                <StatCard label="Cancelled" value={financial.cancelledOrders} color="red" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatCard label="Credit Pack Revenue" value={`$${financial.creditPackRevenue.toFixed(2)}`} color="blue" />
                <StatCard label="Merchandise Revenue" value={`$${financial.merchandiseRevenue.toFixed(2)}`} color="purple" />
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Selling Items</h3>
                <Table
                  headers={['Item', 'Qty Sold', 'Revenue']}
                  rows={financial.topItems.map(i => [
                    i.name,
                    i.quantitySold,
                    `$${i.revenue.toFixed(2)}`
                  ])}
                  empty="No sales in this period"
                />
                <button onClick={() => exportCsv(
                  `financial-report-${start}-${end}`,
                  ['Item', 'Qty Sold', 'Revenue ($)'],
                  financial.topItems.map(i => [i.name, i.quantitySold, i.revenue.toFixed(2)])
                )} className="btn-secondary text-sm px-3 py-1.5 mt-4">
                  ↓ Export Top Items CSV
                </button>
              </div>
            </div>
          )}

          {/* ── Membership ─────────────────────────────────────────────────── */}
          {activeTab === 'membership' && membership && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Members" value={membership.totalMembers} color="blue" />
                <StatCard label="Active" value={membership.activeMembers} color="green" />
                <StatCard label="Inactive" value={membership.inactiveMembers} color="gray" />
                <StatCard label="New This Period" value={membership.newMembersInPeriod} color="purple" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Role Breakdown</h3>
                  <Table
                    headers={['Role', 'Count']}
                    rows={membership.roleBreakdown.map(r => [r.label, r.count])}
                  />
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    New Members ({membership.newMembersInPeriod})
                  </h3>
                  <Table
                    headers={['Name', 'Role', 'Joined']}
                    rows={membership.newMembersList.map(m => [
                      m.name, m.role, fmtDate(m.createdAt)
                    ])}
                    empty="No new members in this period"
                  />
                  <button onClick={() => exportCsv(
                    `membership-report-${start}-${end}`,
                    ['Name', 'Email', 'Role', 'Joined'],
                    membership.newMembersList.map(m => [m.name, m.email, m.role, fmtDate(m.createdAt)])
                  )} className="btn-secondary text-sm px-3 py-1.5 mt-4">
                    ↓ Export New Members CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── CATS ───────────────────────────────────────────────────────── */}
          {activeTab === 'cats' && cats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Active CATS" value={cats.totalActiveCats} color="blue" />
                <StatCard label="New This Period" value={cats.newCatsInPeriod} color="purple" />
                <StatCard label="Converted (Total)" value={cats.convertedAllTime} color="green" />
                <StatCard label="Conversion Rate" value={`${cats.conversionRateAllTime}%`}
                  sub="All time approx." color="amber" />
              </div>
              <div className="card p-4 bg-blue-50 border border-blue-100 text-sm text-blue-700">
                💡 Conversion rate is approximate until the Phase 8 CATS conversion flag is added.
                Once active, each conversion is tracked precisely with date.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    New CATS Sign-ups ({cats.newCatsInPeriod})
                  </h3>
                  <Table
                    headers={['Name', 'Email', 'Credits', 'Joined']}
                    rows={cats.newCatsList.map(c => [
                      c.name, c.email, c.creditBalance, fmtDate(c.createdAt)
                    ])}
                    empty="No new CATS in this period"
                  />
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    All Active CATS ({cats.totalActiveCats})
                  </h3>
                  <Table
                    headers={['Name', 'Credits Left', 'Joined']}
                    rows={cats.activeCatsList.map(c => [
                      c.name,
                      <span className={c.creditBalance === 0 ? 'text-red-500 font-medium' : ''}>
                        {c.creditBalance}
                      </span>,
                      fmtDate(c.createdAt)
                    ])}
                    empty="No active CATS"
                  />
                  <button onClick={() => exportCsv(
                    `cats-report-${start}-${end}`,
                    ['Name', 'Email', 'Credits Remaining', 'Joined'],
                    cats.activeCatsList.map(c => [c.name, c.email, c.creditBalance, fmtDate(c.createdAt)])
                  )} className="btn-secondary text-sm px-3 py-1.5 mt-4">
                    ↓ Export Active CATS CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Attendance ─────────────────────────────────────────────────── */}
          {activeTab === 'attendance' && attendance && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Sessions" value={attendance.totalSessions} color="blue" />
                <StatCard label="Avg Attendance" value={attendance.averageAttendance} color="purple" />
                <StatCard label="Attendance Rate" value={`${attendance.attendanceRate}%`} color="green" />
                <StatCard label="Total Attended" value={attendance.totalAttended} color="gray" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <StatCard label="Attended" value={attendance.statusAttended} color="green" />
                <StatCard label="Late" value={attendance.statusLate} color="amber" />
                <StatCard label="NSBA" value={attendance.statusNsba} color="blue" />
                <StatCard label="Absent" value={attendance.statusAbsent} color="red" />
                <StatCard label="No Show" value={attendance.statusNoShow} color="gray" />
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Session Breakdown</h3>
                <Table
                  headers={['Date', 'Session', 'Location', 'Coach', 'Reg', 'Att', 'Late', 'NSBA', 'Absent']}
                  rows={attendance.sessions.map(s => [
                    fmtDateTime(s.startTime),
                    s.title,
                    s.location ?? '—',
                    s.coachName ?? '—',
                    s.registered,
                    <span className="font-medium text-green-700">{s.attended}</span>,
                    s.late,
                    s.nsba,
                    s.absent,
                  ])}
                  empty="No sessions in this period"
                />
                <button onClick={() => exportCsv(
                  `attendance-report-${start}-${end}`,
                  ['Date', 'Session', 'Location', 'Coach', 'Registered', 'Attended', 'Late', 'NSBA', 'Absent'],
                  attendance.sessions.map(s => [
                    fmtDateTime(s.startTime), s.title, s.location ?? '', s.coachName ?? '',
                    s.registered, s.attended, s.late, s.nsba, s.absent
                  ])
                )} className="btn-secondary text-sm px-3 py-1.5 mt-4">
                  ↓ Export Attendance CSV
                </button>
              </div>
            </div>
          )}

          {/* ── Lanes ──────────────────────────────────────────────────────── */}
          {activeTab === 'lanes' && lanes && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Avg Lanes Used" value={lanes.overallAvgLanes} color="blue" />
                <StatCard label="Avg Attendees" value={lanes.overallAvgAttendees} color="purple" />
                <StatCard label="Sessions w/ Data" value={lanes.sessionsWithLaneData} color="gray" />
              </div>
              {lanes.sessionsWithLaneData === 0 && (
                <div className="card p-4 bg-amber-50 border border-amber-100 text-sm text-amber-700">
                  ⚠️ No lane data recorded yet. Lanes are set on the Attendance Sheet during sessions.
                </div>
              )}
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Average by Day of Week</h3>
                <Table
                  headers={['Day', 'Sessions', 'Avg Lanes', 'Avg Attendees']}
                  rows={lanes.byDayOfWeek.map(d => [
                    d.day, d.sessionCount,
                    d.avgLanes > 0 ? d.avgLanes : '—',
                    d.avgAttendees,
                  ])}
                  empty="No data"
                />
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Session Detail</h3>
                <Table
                  headers={['Date', 'Day', 'Session', 'Lanes', 'Attended']}
                  rows={lanes.sessions.map(s => [
                    fmtDate(s.date),
                    s.dayOfWeek,
                    s.title,
                    s.lanes ?? <span className="text-gray-300">—</span>,
                    s.attended,
                  ])}
                  empty="No sessions in this period"
                />
                <button onClick={() => exportCsv(
                  `lanes-report-${start}-${end}`,
                  ['Date', 'Day', 'Session', 'Lanes', 'Attended'],
                  lanes.sessions.map(s => [
                    fmtDate(s.date), s.dayOfWeek, s.title, s.lanes ?? '', s.attended
                  ])
                )} className="btn-secondary text-sm px-3 py-1.5 mt-4">
                  ↓ Export Lanes CSV
                </button>
              </div>
            </div>
          )}

          {/* ── Coaches ────────────────────────────────────────────────────── */}
          {activeTab === 'coaches' && coaches && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="Total Sessions" value={coaches.totalSessions} color="blue" />
                <StatCard label="Coaches Active" value={coaches.coaches.length} color="purple" />
                <StatCard label="Cancelled"
                  value={coaches.coaches.reduce((s, c) => s + c.sessionsCancelled, 0)}
                  color="red" />
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Coach Sessions</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Note: Individual coach attendance tracking coming in Phase 8.
                  Currently shows assigned vs cancelled sessions.
                </p>
                <Table
                  headers={['Coach', 'Assigned', 'Completed', 'Cancelled']}
                  rows={coaches.coaches.map(c => [
                    c.name,
                    c.sessionsAssigned,
                    <span className="text-green-700 font-medium">{c.sessionsCompleted}</span>,
                    c.sessionsCancelled > 0
                      ? <span className="text-red-500">{c.sessionsCancelled}</span>
                      : 0,
                  ])}
                  empty="No sessions with assigned coaches in this period"
                />
                <button onClick={() => exportCsv(
                  `coaches-report-${start}-${end}`,
                  ['Coach', 'Assigned', 'Completed', 'Cancelled'],
                  coaches.coaches.map(c => [c.name, c.sessionsAssigned, c.sessionsCompleted, c.sessionsCancelled])
                )} className="btn-secondary text-sm px-3 py-1.5 mt-4">
                  ↓ Export Coaches CSV
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}