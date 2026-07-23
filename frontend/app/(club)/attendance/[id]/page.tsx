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
  creditBalance: number
  notes: string | null
}

interface SessionInfo {
  id: number
  title: string
  startTime: string
  endTime: string
  locationId: number | null       // ← add
  locationName: string | null
  coachName: string | null
  coachNoShow: boolean
  capacity: number
  lanesCount?: number
  coachId: number | null
  isCancelled: boolean             // ← add
  cancellationReason: string | null // ← add
}

interface SheetData {
  session: SessionInfo
  members: SheetMember[]
  guests: Guest[]
  lanesEnabled: boolean
  lanesLabel: string
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

interface Guest {
  id: number
  name: string
  email: string | null
  phone: string | null
  homeSuburb: string | null
  isMemberOfAnotherClub: boolean
  associationNumber: string | null
  notes: string | null
  attendedAt: string
}

interface LocationOption {
  id: number
  name: string
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

  // Quick CATS Modal
  const [catsOpen, setCatsOpen] = useState(false)
  const [catsSubmitting, setCatsSubmitting] = useState(false)
  const [catsError, setCatsError] = useState<string | null>(null)
  const [catsForm, setCatsForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  })

  // Guest Modal
  const [guestOpen, setGuestOpen] = useState(false)
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)
  const [guestForm, setGuestForm] = useState({
    name: '', email: '', phone: '',
    emergencyContactName: '', emergencyContactPhone: '',
    homeSuburb: '', isMemberOfAnotherClub: false, associationNumber: '', notes: '',
  })

  // Mark all
  const [markingAll, setMarkingAll] = useState(false)

  // Add these with your other useState declarations at the TOP (before any if/return)
  const [lanesCount, setLanesCount] = useState<number | ''>('')
  const [savingLanes, setSavingLanes] = useState(false)
  const [lanesSaved, setLanesSaved] = useState(false)

  const [coaches, setCoaches] = useState<{ id: number; name: string }[]>([])
  const [updatingCoach, setUpdatingCoach] = useState(false)

  const [locations, setLocations] = useState<LocationOption[]>([])
  const [updatingLocation, setUpdatingLocation] = useState(false)

  // Cancel Session modal
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<{ refundedCount: number } | null>(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportEmail, setReportEmail] = useState('')
  const [sendingReport, setSendingReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  const [savedRecipients, setSavedRecipients] = useState<{ name: string; email: string }[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])

  const [savingNote, setSavingNote] = useState<number | null>(null)
  const [noteValues, setNoteValues] = useState<Record<number, string>>({})

  const [sessionNote, setSessionNote] = useState('')
  const [savingSessionNote, setSavingSessionNote] = useState(false)
  const [sessionNoteSaved, setSessionNoteSaved] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentRole(user.role as UserRole)
    loadSheet()
    api.get<{ id: number; name: string }[]>('/attendance/coaches')
      .then(setCoaches).catch(() => { })
    api.get<LocationOption[]>('/locations/active')
      .then(setLocations).catch(() => { })
    api.get<{ name: string; email: string }[]>('/settings/report-recipients')
      .then(data => setSavedRecipients(data))
      .catch(() => { })
    api.get<{ note: string }>(`/attendance/sessions/${sessionId}/session-note`)
      .then(d => setSessionNote(d.note))
      .catch(() => { })
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
      if (d.session.lanesCount) setLanesCount(d.session.lanesCount)
      // Initialise note values from loaded data
      const notes: Record<number, string> = {}
      d.members.forEach(m => { notes[m.userId] = m.notes ?? '' })
      setNoteValues(notes)
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

  async function handleLocationChange(locationId: string) {
    setUpdatingLocation(true)
    try {
      const result = await api.patch<{ locationId: number | null; locationName: string | null }>(
        `/attendance/sessions/${sessionId}/location`,
        { locationId: locationId ? parseInt(locationId) : null }
      )
      setData(prev => prev ? {
        ...prev,
        session: {
          ...prev.session,
          locationId: result.locationId,
          locationName: result.locationName,
        }
      } : prev)
    } catch { }
    finally { setUpdatingLocation(false) }
  }

  function openCancelSession() {
    setCancelReason('')
    setCancelResult(null)
    setCancelOpen(true)
  }

  async function handleCancelSession() {
    setCancelling(true)
    try {
      const result = await api.post<{ success: boolean; refundedCount: number }>(
        `/attendance/sessions/${sessionId}/cancel`,
        { reason: cancelReason.trim() || null }
      )
      setCancelResult({ refundedCount: result.refundedCount })
      await loadSheet()
    } catch {
      alert('Failed to cancel session')
    } finally {
      setCancelling(false)
    }
  }

  function openCatsSignup() {
    setCatsForm({
      firstName: '', lastName: '', email: '', phone: '',
      emergencyContactName: '', emergencyContactPhone: '',
    })
    setCatsError(null)
    setCatsOpen(true)
  }

  async function handleCatsSignup() {
    setCatsError(null)
    const { firstName, lastName, email, phone } = catsForm
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setCatsError('First name, last name, email and phone are required')
      return
    }

    setCatsSubmitting(true)
    try {
      const signup = await api.post<{
        userId: number
        email: string
        firstName: string
        generatedPassword: string
        initialCredits: number
        message: string
      }>('/public/signup', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        emergencyContactName: catsForm.emergencyContactName.trim() || null,
        emergencyContactPhone: catsForm.emergencyContactPhone.trim() || null,
      })

      // Reuse the walk-in endpoint: registers + marks attended in one call
      await api.post(`/attendance/sessions/${sessionId}/walkin`, signup.userId)

      setCatsOpen(false)
      await loadSheet()
    } catch (err) {
      setCatsError('Failed to register — check the email isn\'t already in use')
    } finally {
      setCatsSubmitting(false)
    }
  }

  function openGuestModal() {
    setGuestForm({
      name: '', email: '', phone: '',
      emergencyContactName: '', emergencyContactPhone: '',
      homeSuburb: '', isMemberOfAnotherClub: false, associationNumber: '', notes: '',
    })
    setGuestError(null)
    setGuestOpen(true)
  }

  async function handleAddGuest() {
    setGuestError(null)
    if (!guestForm.name.trim()) {
      setGuestError('Guest name is required')
      return
    }

    setGuestSubmitting(true)
    try {
      await api.post(`/attendance/sessions/${sessionId}/guest`, {
        name: guestForm.name.trim(),
        email: guestForm.email.trim() || null,
        phone: guestForm.phone.trim() || null,
        emergencyContactName: guestForm.emergencyContactName.trim() || null,
        emergencyContactPhone: guestForm.emergencyContactPhone.trim() || null,
        homeSuburb: guestForm.homeSuburb.trim() || null,
        isMemberOfAnotherClub: guestForm.isMemberOfAnotherClub,
        associationNumber: guestForm.associationNumber.trim() || null,
        notes: guestForm.notes.trim() || null,
      })
      setGuestOpen(false)
      await loadSheet()
    } catch {
      setGuestError('Failed to add guest')
    } finally {
      setGuestSubmitting(false)
    }
  }

  async function saveNote(userId: number) {
    setSavingNote(userId)
    try {
      await api.patch(`/attendance/sessions/${sessionId}/note`, {
        userId,
        notes: noteValues[userId] || null,
      })
    } catch { }
    finally { setSavingNote(null) }
  }

  async function saveSessionNote() {
    setSavingSessionNote(true)
    setSessionNoteSaved(false)
    try {
      await api.patch(`/attendance/sessions/${sessionId}/session-note`, { note: sessionNote })
      setSessionNoteSaved(true)
      setTimeout(() => setSessionNoteSaved(false), 2000)
    } catch { }
    finally { setSavingSessionNote(false) }
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
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>📍</span>
                <select
                  value={data?.session.locationId?.toString() ?? ''}
                  onChange={e => handleLocationChange(e.target.value)}
                  disabled={updatingLocation}
                  className="text-sm bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">— No location —</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                {updatingLocation && <span className="text-xs text-gray-400 ml-1">Saving...</span>}
              </div>
              {/* was: {session.coachName && <span>👤 {session.coachName}</span>} */}
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>👤</span>
                <select
                  value={data?.session.coachNoShow ? 'noshow' : (data?.session.coachId?.toString() ?? '')}
                  onChange={async (e) => {
                    const val = e.target.value
                    setUpdatingCoach(true)
                    try {
                      const result = await api.patch<{
                        coachId: number | null
                        coachName: string | null
                        coachNoShow: boolean
                      }>(`/attendance/sessions/${sessionId}/coach`,
                        val === 'noshow'
                          ? { coachId: null, noShow: true }
                          : { coachId: val ? parseInt(val) : null, noShow: false }
                      )
                      setData(prev => prev ? {
                        ...prev,
                        session: {
                          ...prev.session,
                          coachId: result.coachId,
                          coachName: result.coachName,
                          coachNoShow: result.coachNoShow,
                        }
                      } : prev)
                    } catch { }
                    finally { setUpdatingCoach(false) }
                  }}
                  disabled={updatingCoach}
                  className="text-sm bg-transparent border-0 border-b border-dashed focus:outline-none cursor-pointer disabled:opacity-50"
                  style={{
                    color: data?.session.coachNoShow ? '#d97706' : 'inherit',
                    borderColor: data?.session.coachNoShow ? '#d97706' : '#d1d5db'
                  }}
                >
                  <option value="">— Unassigned —</option>
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value="noshow">⚠ Coach No Show</option>
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

      {session.isCancelled && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-800">⛔ This session was cancelled</p>
          {session.cancellationReason && (
            <p className="text-xs text-red-600 mt-1">Reason: {session.cancellationReason}</p>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="card p-4 space-y-4">

        {/* Row 1 — stats */}
        <div className="flex items-center gap-6 flex-wrap">
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
          {data?.lanesEnabled && (
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
                {savingLanes ? 'Saving...' : lanesSaved ? '✓ Saved' : (data?.lanesLabel ?? 'Lanes')}
              </p>
            </div>
          )}
        </div>

        {/* Row 2 — progress bar */}
        <div>
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

        {/* Row 3 — action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={openWalkin} className="btn-secondary text-sm px-3 py-2">
            + Walk-in
          </button>
          <button onClick={openCatsSignup} className="btn-secondary text-sm px-3 py-2">
            + CATS
          </button>
          <button onClick={openGuestModal} className="btn-secondary text-sm px-3 py-2">
            + Guest
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
          <button
            onClick={() => { setReportOpen(true); setReportSent(false) }}
            className="btn-secondary text-sm px-3 py-2 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Report
          </button>
          {!session.isCancelled && (
            <button onClick={openCancelSession} className="btn-danger text-sm px-3 py-2">
              ⛔ Cancel Session
            </button>
          )}
        </div>
      </div>

      {/* Session Notes */}
      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session Notes</p>
          {savingSessionNote && <span className="text-xs text-gray-400">Saving…</span>}
          {sessionNoteSaved && <span className="text-xs text-green-600">✓ Saved</span>}
        </div>
        <textarea
          rows={2}
          placeholder="General session notes — visible to staff only…"
          value={sessionNote}
          onChange={e => setSessionNote(e.target.value)}
          onBlur={saveSessionNote}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none placeholder-gray-400 text-gray-700"
        />
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

      {members.map(m => (
        <div key={m.userId}
          className={`card p-4 border transition-colors ${m.status ? 'border-transparent' : 'border-gray-200'
            } ${statusStyle(m.status).replace('border-', 'border-l-4 border-l-').split(' ').filter(c => c.includes('border-l')).join(' ')}`}
        >
          {/* Row 1 — avatar + name + current status */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {m.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{m.fullName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyle(m.status)}`}>
                  {statusLabel(m.status)}
                </span>
                {m.status === 'nsba' && m.creditRefunded && (
                  <span className="text-xs text-blue-500">Credit refunded</span>
                )}
                {m.creditBalance <= 0 && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    ⚠ {m.creditBalance < 0 ? `${m.creditBalance} credits` : 'No credits'} — top up needed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2 — status action buttons */}
          <div className="flex gap-1.5 flex-wrap mb-3">
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

          {/* Row 3 — notes */}
          <div className="flex items-center gap-2">
            <textarea
              rows={1}
              placeholder="Add a note (injury, lead, follow-up…)"
              value={noteValues[m.userId] ?? ''}
              onChange={e => setNoteValues(prev => ({ ...prev, [m.userId]: e.target.value }))}
              onBlur={() => saveNote(m.userId)}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none placeholder-gray-400 text-gray-700"
            />
            {savingNote === m.userId && (
              <span className="text-xs text-gray-400 flex-shrink-0">Saving…</span>
            )}
          </div>
        </div>
      ))}

      {data.guests.length > 0 && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Guests ({data.guests.length})
          </p>
          {data.guests.map(g => (
            <div key={g.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{g.name}</p>
                  <span className="badge badge-gray text-xs">Guest</span>
                  {g.isMemberOfAnotherClub && (
                    <span className="badge badge-blue text-xs">Other Club{g.associationNumber ? ` · ${g.associationNumber}` : ''}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[g.phone, g.homeSuburb].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {new Date(g.attendedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── QR Code Modal ─────────────────────────────────────────────────── */}
      {
        qrOpen && (
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
        )
      }

      {/* ── Email Report Modal ─────────────────────────────────────────────── */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Send Attendance Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">{session.title}</p>
              </div>
              <button onClick={() => setReportOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {reportSent ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-3xl">✅</p>
                  <p className="font-medium text-gray-900">Report sent!</p>
                  <button onClick={() => setReportOpen(false)}
                    className="btn-secondary px-6 py-2 text-sm mt-2">Close</button>
                </div>
              ) : (
                <>
                  {savedRecipients.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Saved Recipients
                      </label>
                      <div className="space-y-2">
                        {savedRecipients.map((r, i) => (
                          <label key={i} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                            <input type="checkbox"
                              checked={selectedRecipients.includes(r.email)}
                              onChange={e => setSelectedRecipients(prev =>
                                e.target.checked
                                  ? [...prev, r.email]
                                  : prev.filter(x => x !== r.email)
                              )}
                              className="rounded border-gray-300" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{r.name}</p>
                              <p className="text-xs text-gray-400">{r.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {savedRecipients.length > 0 ? 'Additional Email (optional)' : 'Send to'}
                    </label>
                    <input
                      type="email"
                      className="input"
                      placeholder="one-off@email.com"
                      value={reportEmail}
                      onChange={e => setReportEmail(e.target.value)}
                      autoFocus={savedRecipients.length === 0}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={() => setReportOpen(false)}
                      className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                    <button
                      disabled={sendingReport || (selectedRecipients.length === 0 && !reportEmail.trim())}
                      onClick={async () => {
                        setSendingReport(true)
                        try {
                          const emails = [
                            ...selectedRecipients,
                            ...(reportEmail.trim() ? [reportEmail.trim()] : [])
                          ]
                          await api.post(`/attendance/sessions/${sessionId}/email-report`, { emails })
                          setReportSent(true)
                        } catch {
                          alert('Failed to send report')
                        } finally {
                          setSendingReport(false)
                        }
                      }}
                      className="btn-primary px-4 py-2 text-sm">
                      {sendingReport ? 'Sending…' : 'Send Report'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Walk-in Modal ──────────────────────────────────────────────────── */}
      {
        walkinOpen && (
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

        )
      }

      {/* ── Cancel Session Modal ────────────────────────────────────────────── */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Cancel Session</h2>
                <p className="text-xs text-gray-400 mt-0.5">{session.title}</p>
              </div>
              <button onClick={() => setCancelOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {cancelResult ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-3xl">✅</p>
                  <p className="font-medium text-gray-900">Session cancelled</p>
                  <p className="text-sm text-gray-500">
                    {cancelResult.refundedCount} member{cancelResult.refundedCount !== 1 ? 's' : ''} refunded
                  </p>
                  <button onClick={() => setCancelOpen(false)} className="btn-secondary px-6 py-2 text-sm mt-2">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                    This will refund credits to everyone registered — except members already marked
                    <strong> Attended</strong> or <strong> NSBA</strong> (already refunded). This cannot be undone.
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason <span className="text-gray-400 font-normal">(optional, shown in credit history)</span>
                    </label>
                    <textarea
                      rows={3}
                      className="input text-sm w-full resize-none"
                      placeholder="e.g. Pool closed for maintenance"
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setCancelOpen(false)} className="btn-secondary px-4 py-2 text-sm">
                      Back
                    </button>
                    <button
                      onClick={handleCancelSession}
                      disabled={cancelling}
                      className="btn-danger px-4 py-2 text-sm">
                      {cancelling ? 'Cancelling…' : 'Cancel Session & Refund'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Guest Modal ─────────────────────────────────────────────────── */}
      {guestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">Add Guest</h2>
                <p className="text-xs text-gray-400 mt-0.5">One-off visitor — pays the club directly, no credit used</p>
              </div>
              <button onClick={() => setGuestOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {guestError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {guestError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" className="input" value={guestForm.name}
                  onChange={e => setGuestForm(prev => ({ ...prev, name: e.target.value }))}
                  autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="input" value={guestForm.email}
                    onChange={e => setGuestForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" className="input" value={guestForm.phone}
                    onChange={e => setGuestForm(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Home Suburb</label>
                <input type="text" className="input" value={guestForm.homeSuburb}
                  onChange={e => setGuestForm(prev => ({ ...prev, homeSuburb: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                  <input type="text" className="input" value={guestForm.emergencyContactName}
                    onChange={e => setGuestForm(prev => ({ ...prev, emergencyContactName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                  <input type="tel" className="input" value={guestForm.emergencyContactPhone}
                    onChange={e => setGuestForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }))} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={guestForm.isMemberOfAnotherClub}
                    onChange={e => setGuestForm(prev => ({ ...prev, isMemberOfAnotherClub: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Member of another club</span>
                </label>

                {guestForm.isMemberOfAnotherClub && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Association Number</label>
                    <input type="text" className="input" value={guestForm.associationNumber}
                      onChange={e => setGuestForm(prev => ({ ...prev, associationNumber: e.target.value }))} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} className="input text-sm w-full resize-none"
                  value={guestForm.notes}
                  onChange={e => setGuestForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setGuestOpen(false)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={handleAddGuest}
                disabled={guestSubmitting}
                className="btn-primary px-4 py-2 text-sm">
                {guestSubmitting ? 'Adding…' : 'Add Guest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick CATS Sign-up Modal ──────────────────────────────────────── */}
      {catsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">Quick CATS Sign-Up</h2>
                <p className="text-xs text-gray-400 mt-0.5">Trial member will be registered and marked attended</p>
              </div>
              <button onClick={() => setCatsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {catsError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {catsError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" className="input" value={catsForm.firstName}
                    onChange={e => setCatsForm(prev => ({ ...prev, firstName: e.target.value }))}
                    autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" className="input" value={catsForm.lastName}
                    onChange={e => setCatsForm(prev => ({ ...prev, lastName: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" className="input" value={catsForm.email}
                  onChange={e => setCatsForm(prev => ({ ...prev, email: e.target.value }))} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" className="input" value={catsForm.phone}
                  onChange={e => setCatsForm(prev => ({ ...prev, phone: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                  <input type="text" className="input" value={catsForm.emergencyContactName}
                    onChange={e => setCatsForm(prev => ({ ...prev, emergencyContactName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                  <input type="tel" className="input" value={catsForm.emergencyContactPhone}
                    onChange={e => setCatsForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setCatsOpen(false)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={handleCatsSignup}
                disabled={catsSubmitting}
                className="btn-primary px-4 py-2 text-sm">
                {catsSubmitting ? 'Registering…' : 'Register & Mark Attended'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  )
}