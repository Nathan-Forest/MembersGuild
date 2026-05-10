'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface SessionResponse {
  id: number
  title: string
  description: string | null
  locationId: number | null
  locationName: string | null
  coachId: number | null
  coachName: string | null
  startTime: string
  endTime: string
  capacity: number
  creditCost: number
  registrationCutoffHours: number
  isCancelled: boolean
  isRecurring: boolean
  bookedCount: number
  isBooked: boolean
}

type ViewMode = 'list' | 'month'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function groupByDate(sessions: SessionResponse[]) {
  const groups: Record<string, SessionResponse[]> = {}
  for (const s of sessions) {
    const key = new Date(s.startTime).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return groups
}

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
}

function isTomorrow(iso: string) {
  const d = new Date(iso)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
}

function formatDateLabel(label: string, iso: string) {
  if (isToday(iso)) return `Today — ${label}`
  if (isTomorrow(iso)) return `Tomorrow — ${label}`
  return label
}

function getDaysInMonth(year: number, month: number) {
  const days: (Date | null)[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  // Monday-start: 0=Mon, 6=Sun
  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function CalendarPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [bookingId, setBookingId] = useState<number | null>(null)
  const [bookingError, setBookingError] = useState<Record<number, string>>({})
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Month view state
  const now = new Date()
  const [monthYear, setMonthYear] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selectedSession, setSelectedSession] = useState<SessionResponse | null>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentRole(user.role as UserRole)
    loadSessions()
    loadBalance()
  }, [router])

  async function loadSessions() {
    setLoading(true)
    try {
      const from = new Date().toISOString()
      const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      const data = await api.get<SessionResponse[]>(`/sessions?from=${from}&to=${to}`)
      setSessions(data.filter(s => !s.isCancelled))
    } catch { }
    finally { setLoading(false) }
  }

  async function loadBalance() {
    try {
      const data = await api.get<{ creditBalance: number }>('/credits/my-account')
      setCreditBalance(data.creditBalance)
    } catch { }
  }

  async function handleBook(sessionId: number) {
    setBookingId(sessionId)
    setBookingError(e => ({ ...e, [sessionId]: '' }))
    try {
      await api.post(`/sessions/${sessionId}/book`, {})
      await loadSessions()
      await loadBalance()
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, isBooked: true, bookedCount: prev.bookedCount + 1 } : null)
      }
    } catch (err) {
      setBookingError(e => ({
        ...e,
        [sessionId]: err instanceof Error ? err.message : 'Booking failed'
      }))
    } finally {
      setBookingId(null)
    }
  }

  async function handleUnbook(sessionId: number) {
    setBookingId(sessionId)
    setBookingError(e => ({ ...e, [sessionId]: '' }))
    try {
      await api.delete(`/sessions/${sessionId}/book`)
      await loadSessions()
      await loadBalance()
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, isBooked: false, bookedCount: prev.bookedCount - 1 } : null)
      }
    } catch (err) {
      setBookingError(e => ({
        ...e,
        [sessionId]: err instanceof Error ? err.message : 'Failed to unregister'
      }))
    } finally {
      setBookingId(null)
    }
  }

  const isCoach = currentRole === 'coach'
  const grouped = groupByDate(sessions)
  const dateKeys = Object.keys(grouped)
  const calendarDays = getDaysInMonth(monthYear.year, monthYear.month)

  function getSessionsForDay(day: Date) {
    return sessions.filter(s => sameDay(new Date(s.startTime), day))
  }

  function prevMonth() {
    setMonthYear(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    )
  }

  function nextMonth() {
    setMonthYear(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    )
  }

  const monthLabel = new Date(monthYear.year, monthYear.month).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'list' ? 'Upcoming sessions — next 90 days' : monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {creditBalance !== null && !isCoach && (
            <div
              className="rounded-xl px-4 py-2 text-white text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {creditBalance} credit{creditBalance !== 1 ? 's' : ''}
            </div>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'text-white'
                  : 'text-gray-600 bg-white hover:bg-gray-50'
              }`}
              style={viewMode === 'list' ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'month'
                  ? 'text-white'
                  : 'text-gray-600 bg-white hover:bg-gray-50'
              }`}
              style={viewMode === 'month' ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Month
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
        </div>
      ) : (
        <>
          {/* ── List View ─────────────────────────────────────────────────── */}
          {viewMode === 'list' && (
            sessions.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-3xl mb-3">📅</p>
                <p className="text-sm font-medium text-gray-600">No upcoming sessions</p>
                <p className="text-xs text-gray-400 mt-1">Check back soon</p>
              </div>
            ) : (
              <div className="space-y-8">
                {dateKeys.map(dateLabel => (
                  <div key={dateLabel}>
                    <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                      {formatDateLabel(dateLabel, grouped[dateLabel][0].startTime)}
                    </h2>
                    <div className="space-y-3">
                      {grouped[dateLabel].map(s => {
                        const remaining = s.capacity - s.bookedCount
                        const isFull = remaining <= 0
                        const isLow = remaining <= 5 && remaining > 0
                        const isPast = new Date(s.startTime) < new Date()
                        const cutoffPassed = Date.now() > new Date(s.startTime).getTime() - s.registrationCutoffHours * 60 * 60 * 1000
                        const isLoading = bookingId === s.id
                        const err = bookingError[s.id]

                        return (
                          <div key={s.id} className="card p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-16 text-center">
                                <p className="text-sm font-bold text-gray-900">
                                  {new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(s.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-gray-900">{s.title}</p>
                                  {s.isBooked && <span className="badge badge-green text-xs">Registered ✓</span>}
                                </div>
                                {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                                  {s.locationName && <span>📍 {s.locationName}</span>}
                                  {s.coachName && <span>👤 {s.coachName}</span>}
                                  <span className={isFull ? 'text-red-600 font-semibold' : isLow ? 'text-amber-600 font-semibold' : 'text-green-700'}>
                                    👥 {remaining <= 0 ? 'Full' : `${remaining} spot${remaining !== 1 ? 's' : ''} left`}
                                  </span>
                                  {!isCoach && <span>💳 {s.creditCost} credit{s.creditCost !== 1 ? 's' : ''}</span>}
                                </div>
                                {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
                              </div>
                              {!isCoach && !isPast && (
                                <div className="flex-shrink-0">
                                  {s.isBooked ? (
                                    <button onClick={() => handleUnbook(s.id)} disabled={isLoading} className="btn-secondary text-xs px-3 py-1.5">
                                      {isLoading ? '…' : 'Unregister'}
                                    </button>
                                  ) : cutoffPassed ? (
                                    <span className="text-xs text-gray-400">Closed</span>
                                  ) : isFull ? (
                                    <span className="text-xs text-red-500 font-medium">Full</span>
                                  ) : (
                                    <button onClick={() => handleBook(s.id)} disabled={isLoading} className="btn-primary text-xs px-3 py-1.5">
                                      {isLoading ? '…' : 'Register'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── Month View ────────────────────────────────────────────────── */}
          {viewMode === 'month' && (
            <div className="card overflow-hidden">
              {/* Month nav */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={prevMonth} className="btn-secondary p-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="font-semibold text-gray-900">{monthLabel}</h2>
                <button onClick={nextMonth} className="btn-secondary p-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {WEEKDAYS.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const todayDate = new Date()
                  const isCurrentDay = day && sameDay(day, todayDate)
                  const daySessions = day ? getSessionsForDay(day) : []
                  const isPastDay = day && day < new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate())

                  return (
                    <div
                      key={idx}
                      className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 ${
                        !day ? 'bg-gray-50' : isPastDay ? 'bg-white opacity-50' : 'bg-white'
                      }`}
                    >
                      {day && (
                        <>
                          <div className="flex justify-center mb-1">
                            <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                              isCurrentDay
                                ? 'text-white'
                                : 'text-gray-600'
                            }`}
                              style={isCurrentDay ? { backgroundColor: 'var(--color-primary)' } : {}}
                            >
                              {day.getDate()}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {daySessions.map(s => (
                              <button
                                key={s.id}
                                onClick={() => setSelectedSession(s)}
                                className={`w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate transition-opacity hover:opacity-80 ${
                                  s.isBooked ? 'text-white' : 'text-white opacity-90'
                                }`}
                                style={{ backgroundColor: s.isBooked ? '#16a34a' : 'var(--color-primary)' }}
                              >
                                {new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })} {s.title}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="p-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-primary)' }} />
                  Session available
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-600" />
                  Registered
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Session Detail Popup (Month View) ────────────────────────────── */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">{selectedSession.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedSession.startTime).toLocaleDateString('en-AU', {
                    weekday: 'long', day: 'numeric', month: 'long'
                  })}
                </p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedSession.description && (
                <p className="text-sm text-gray-600">{selectedSession.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>🕐</span>
                  <span>
                    {new Date(selectedSession.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {' – '}
                    {new Date(selectedSession.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
                {selectedSession.locationName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>📍</span><span>{selectedSession.locationName}</span>
                  </div>
                )}
                {selectedSession.coachName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>👤</span><span>{selectedSession.coachName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <span>👥</span>
                  <span className={
                    selectedSession.bookedCount >= selectedSession.capacity ? 'text-red-600 font-semibold' :
                    selectedSession.capacity - selectedSession.bookedCount <= 5 ? 'text-amber-600 font-semibold' :
                    'text-green-700'
                  }>
                    {selectedSession.capacity - selectedSession.bookedCount <= 0
                      ? 'Full'
                      : `${selectedSession.capacity - selectedSession.bookedCount} of ${selectedSession.capacity} spots left`}
                  </span>
                </div>
                {!isCoach && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>💳</span>
                    <span>{selectedSession.creditCost} credit{selectedSession.creditCost !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {selectedSession.isBooked && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium text-center">
                  ✓ You are registered for this session
                </div>
              )}

              {bookingError[selectedSession.id] && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {bookingError[selectedSession.id]}
                </div>
              )}

              {!isCoach && new Date(selectedSession.startTime) > new Date() && (
                <div className="flex gap-3">
                  {selectedSession.isBooked ? (
                    <button
                      onClick={() => handleUnbook(selectedSession.id)}
                      disabled={bookingId === selectedSession.id}
                      className="btn-secondary flex-1 py-2.5"
                    >
                      {bookingId === selectedSession.id ? 'Processing…' : 'Unregister'}
                    </button>
                  ) : Date.now() > new Date(selectedSession.startTime).getTime() - selectedSession.registrationCutoffHours * 60 * 60 * 1000 ? (
                    <div className="flex-1 text-center text-sm text-gray-400 py-2.5">Registration closed</div>
                  ) : selectedSession.bookedCount >= selectedSession.capacity ? (
                    <div className="flex-1 text-center text-sm text-red-500 font-medium py-2.5">Session Full</div>
                  ) : (
                    <button
                      onClick={() => handleBook(selectedSession.id)}
                      disabled={bookingId === selectedSession.id}
                      className="btn-primary flex-1 py-2.5"
                    >
                      {bookingId === selectedSession.id ? 'Processing…' : `Register — ${selectedSession.creditCost} credit${selectedSession.creditCost !== 1 ? 's' : ''}`}
                    </button>
                  )}
                  <button onClick={() => setSelectedSession(null)} className="btn-secondary px-4 py-2.5">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}