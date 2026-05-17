'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface SheetMember {
  userId: number
  fullName: string
  email: string
  role: string
  status: string | null
  creditRefunded: boolean
}

interface SessionInfo {
  id: number
  title: string
  startTime: string
  endTime: string
  locationName: string | null
  coachName: string | null
  capacity: number
  lanesCount?: number
  coachId: number | null
}

interface SheetData {
  session: SessionInfo
  members: SheetMember[]
}

interface QrData {
  token: string
  checkinUrl: string
  expiresAt: string
}

interface AllMember {
  id: number
  firstName: string
  lastName: string
  email: string
}

const STATUS_OPTIONS = [
  { value: 'attended', label: '✓ Attended', color: 'bg-green-500 text-white' },
  { value: 'late', label: '◷ Late', color: 'bg-amber-500 text-white' },
  { value: 'nsba', label: '↩ NSBA', color: 'bg-blue-500 text-white' },
  { value: 'absent', label: '✕ Absent', color: 'bg-red-500 text-white' },
]

function statusStyle(status: string | null) {
  switch (status) {
    case 'attended': return 'bg-green-100 text-green-800 border-green-200'
    case 'late': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'nsba': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'absent': return 'bg-red-100 text-red-800 border-red-200'
    case 'noshow': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-500 border-gray-200'
  }
}

function statusLabel(status: string | null) {
  switch (status) {
    case 'attended': return '✓ Attended'
    case 'late': return '◷ Late'
    case 'nsba': return '↩ NSBA'
    case 'absent': return '✕ Absent'
    case 'noshow': return '✕ No Show'
    default: return '— Unmarked'
  }
}

export default function AttendanceSheetPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = parseInt(params.id as string)

  const [data, setData] = useState<SheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<number | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)

  // QR Modal
  const [qrOpen, setQrOpen] = useState(false)
  const [qrData, setQrData] = useState<QrData | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Walk-in Modal
  const [walkinOpen, setWalkinOpen] = useState(false)
  const [allMembers, setAllMembers] = useState<AllMember[]>([])
  const [walkinSearch, setWalkinSearch] = useState('')
  const [walkinLoading, setWalkinLoading] = useState(false)

  // Mark all
  const [markingAll, setMarkingAll] = useState(false)

  // Add these with your other useState declarations at the TOP (before any if/return)
  const [lanesCount, setLanesCount] = useState<number | ''>('')
  const [savingLanes, setSavingLanes] = useState(false)
  const [lanesSaved, setLanesSaved] = useState(false)

  const [coaches, setCoaches] = useState<{ id: number; name: string }[]>([])
  const [updatingCoach, setUpdatingCoach] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentRole(user.role as UserRole)
    loadSheet()
    api.get<{ id: number; name: string }[]>('/attendance/coaches')
    .then(setCoaches).catch(() => {})
  }, [router, sessionId])

  // Auto-refresh every 30 seconds so QR check-ins appear automatically
  useEffect(() => {
    const interval = setInterval(() => {
      loadSheet()
    }, 30000)
    return () => clearInterval(interval)
  }, [sessionId])

  async function loadSheet() {
    setLoading(true)
    try {
      const d = await api.get<SheetData>(`/attendance/sessions/${sessionId}/sheet`)
      setData(d)
      if (d.session.lanesCount) setLanesCount(d.session.lanesCount)  // ← add this
    } catch { }
    finally { setLoading(false) }

  }

  async function markAttendance(userId: number, status: string) {
    setMarking(userId)
    try {
      await api.post(`/attendance/sessions/${sessionId}/mark`, { userId, status, notes: null })
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          members: prev.members.map(m =>
            m.userId === userId
              ? { ...m, status, creditRefunded: status === 'nsba' }
              : m
          )
        }
      })
    } catch { }
    finally { setMarking(null) }
  }

  async function markAllAttended() {
    if (!data) return
    const unmarked = data.members.filter(m => !m.status)
    if (unmarked.length === 0) return
    if (!confirm(`Mark all ${unmarked.length} unmarked members as Attended?`)) return

    setMarkingAll(true)
    for (const m of unmarked) {
      await markAttendance(m.userId, 'attended')
    }
    setMarkingAll(false)
  }

  async function openQr() {
    setQrLoading(true)
    setQrOpen(true)
    try {
      const d = await api.get<QrData>(`/attendance/sessions/${sessionId}/qr`)
      setQrData(d)

      // Generate QR code on canvas
      setTimeout(async () => {
        if (qrCanvasRef.current && d.checkinUrl) {
          const QRCode = (await import('qrcode')).default
          await QRCode.toCanvas(qrCanvasRef.current, d.checkinUrl, {
            width: 280,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' }
          })
        }
      }, 100)
    } catch { }
    finally { setQrLoading(false) }
  }

  async function openWalkin() {
    setWalkinSearch('')
    setWalkinOpen(true)
    try {
      const members = await api.get<AllMember[]>('/members')
      setAllMembers(members)
    } catch { }
  }

  async function handleWalkin(memberId: number) {
    setWalkinLoading(true)
    try {
      await api.post(`/attendance/sessions/${sessionId}/walkin`, memberId)
      setWalkinOpen(false)
      await loadSheet()
    } catch { }
    finally { setWalkinLoading(false) }
  }

  const filteredWalkins = allMembers.filter(m => {
    const registered = data?.members.some(sm => sm.userId === m.id)
    if (registered) return false
    const q = walkinSearch.toLowerCase()
    return `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
  })

  const attended = data?.members.filter(m => m.status === 'attended').length ?? 0
  const marked = data?.members.filter(m => m.status).length ?? 0
  const total = data?.members.length ?? 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-100" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { session, members } = data

  async function handleLanesChange(value: string) {
    const num = parseInt(value)
    if (isNaN(num)) return
    setSavingLanes(true)
    setLanesSaved(false)
    try {
      await api.patch(`/attendance/sessions/${sessionId}/lanes`, num)
      setLanesSaved(true)
      setTimeout(() => setLanesSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save lanes:', err)
    } finally {
      setSavingLanes(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Attendance
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{session.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              <span>📅 {new Date(session.startTime).toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}</span>
              <span>🕐 {new Date(session.startTime).toLocaleTimeString('en-AU', {
                hour: '2-digit', minute: '2-digit', hour12: false
              })}–{new Date(session.endTime).toLocaleTimeString('en-AU', {
                hour: '2-digit', minute: '2-digit', hour12: false
              })}</span>
              {session.locationName && <span>📍 {session.locationName}</span>}
              {/* was: {session.coachName && <span>👤 {session.coachName}</span>} */}
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>👤</span>
                <select
                  value={data?.session.coachId ?? ''}
                  onChange={async (e) => {
                    const coachId = e.target.value === '' ? null : parseInt(e.target.value)
                    setUpdatingCoach(true)
                    try {
                      const result = await api.patch<{ coachId: number | null; coachName: string | null }>(
                        `/attendance/sessions/${sessionId}/coach`, coachId
                      )
                      setData(prev => prev ? {
                        ...prev,
                        session: {
                          ...prev.session,
                          coachId: result.coachId,
                          coachName: result.coachName,
                        }
                      } : prev)
                    } catch { }
                    finally { setUpdatingCoach(false) }
                  }}
                  disabled={updatingCoach}
                  className="text-sm text-gray-500 bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-gray-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="">— Coach No Show —</option>
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {updatingCoach && <span className="text-xs text-gray-400 ml-1">Saving...</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={openQr} className="btn-secondary px-3 py-2 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QR Code
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="card p-4 flex items-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{attended}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Attended</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{marked}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Marked</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-600">{total}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Registered</p>
        </div>

        {/* Lanes Used */}
        <div className="text-center">
          <input
            type="number"
            min="1"
            max="20"
            value={lanesCount}
            onChange={e => setLanesCount(e.target.value === '' ? '' : parseInt(e.target.value))}
            onBlur={() => {
              if (lanesCount !== '' && !isNaN(lanesCount as number)) {
                handleLanesChange(String(lanesCount))
              }
            }}
            className="w-14 text-2xl font-bold text-center text-purple-600 bg-transparent border-0 border-b-2 border-purple-200 focus:border-purple-500 focus:outline-none"
            placeholder="—"
          />
          <p className={`text-xs uppercase tracking-wide mt-0.5 ${lanesSaved ? 'text-green-600' : 'text-gray-400'}`}>
            {savingLanes ? 'Saving...' : lanesSaved ? '✓ Saved' : 'Lanes Used'}
          </p>
        </div>

        <div className="flex-1" />

        {/* Progress bar */}
        <div className="flex-1 max-w-xs">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{total > 0 ? Math.round((marked / total) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${total > 0 ? (marked / total) * 100 : 0}%`,
                backgroundColor: marked === total && total > 0 ? '#16a34a' : 'var(--color-primary)'
              }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={openWalkin}
            className="btn-secondary text-sm px-3 py-2"
          >
            + Walk-in
          </button>
          <button
            onClick={markAllAttended}
            disabled={markingAll || members.every(m => m.status)}
            className="btn-primary text-sm px-3 py-2"
          >
            {markingAll ? 'Marking…' : 'Mark All Attended'}
          </button>
          <button
            onClick={loadSheet}
            className="btn-secondary text-sm px-3 py-2 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        <span className="font-medium text-gray-600">Tap a status to mark:</span>
        {STATUS_OPTIONS.map(o => (
          <span key={o.value} className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.color}`}>
            {o.label}
          </span>
        ))}
        <span className="ml-2 text-blue-600 font-medium">↩ NSBA = credit refunded</span>
      </div>

      {/* Member list */}
      {members.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">👥</p>
          <p className="text-sm font-medium text-gray-600">No members registered</p>
          <p className="text-xs text-gray-400 mt-1">Use the Walk-in button to add members</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.userId}
              className={`card p-4 flex items-center gap-4 border transition-colors ${m.status ? 'border-transparent' : 'border-gray-200'
                } ${statusStyle(m.status).replace('border-', 'border-l-4 border-l-').split(' ').filter(c => c.includes('border-l')).join(' ')}`}
            >
              {/* Avatar */}
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {m.fullName.charAt(0)}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{m.fullName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyle(m.status)}`}>
                    {statusLabel(m.status)}
                  </span>
                  {m.status === 'nsba' && m.creditRefunded && (
                    <span className="text-xs text-blue-500">Credit refunded</span>
                  )}
                </div>
              </div>

              {/* Status buttons */}
              <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => markAttendance(m.userId, opt.value)}
                    disabled={marking === m.userId}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${m.status === opt.value
                      ? opt.color + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {marking === m.userId ? '…' : opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── QR Code Modal ─────────────────────────────────────────────────── */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm text-center">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Session QR Code</h2>
                <p className="text-xs text-gray-400 mt-0.5">Members scan to check in automatically</p>
              </div>
              <button onClick={() => setQrOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {qrLoading ? (
                <div className="w-[280px] h-[280px] mx-auto bg-gray-100 rounded-xl animate-pulse" />
              ) : (
                <canvas ref={qrCanvasRef} className="mx-auto rounded-xl" />
              )}

              {qrData && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-400">
                    Expires {new Date(qrData.expiresAt).toLocaleTimeString('en-AU', {
                      hour: '2-digit', minute: '2-digit', hour12: true
                    })}
                  </p>
                  <p className="text-xs font-mono text-gray-400 break-all bg-gray-50 rounded-lg p-2">
                    {qrData.checkinUrl}
                  </p>
                </div>
              )}

              <button
                onClick={() => { setQrData(null); openQr() }}
                className="btn-secondary w-full py-2 mt-4 text-sm"
              >
                Regenerate QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Walk-in Modal ──────────────────────────────────────────────────── */}
      {walkinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">Add Walk-in</h2>
                <p className="text-xs text-gray-400 mt-0.5">Member will be registered and marked attended</p>
              </div>
              <button onClick={() => setWalkinOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <input
                type="text"
                placeholder="Search members…"
                className="input"
                value={walkinSearch}
                onChange={e => setWalkinSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {filteredWalkins.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">
                    {walkinSearch ? 'No matching members' : 'All members are already registered'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredWalkins.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleWalkin(m.id)}
                      disabled={walkinLoading}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        {m.firstName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}