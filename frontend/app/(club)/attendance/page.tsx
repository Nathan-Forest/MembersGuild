'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface AttendanceSession {
  id: number
  title: string
  locationName: string | null
  coachName: string | null
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  attendedCount: number
  markedCount: number
}

type ViewMode = 'list' | 'month'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function getDaysInMonth(year: number, month: number) {
  const days: (Date | null)[] = []
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function attendanceColor(s: AttendanceSession) {
  if (s.markedCount === 0) return 'bg-gray-100 text-gray-600'
  if (s.markedCount < s.bookedCount) return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-800'
}

function isPast(iso: string) {
  return new Date(iso) < new Date()
}

export default function AttendancePage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const now = new Date()
  const [monthYear, setMonthYear] = useState({ year: now.getFullYear(), month: now.getMonth() })

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    const role = user.role as UserRole
    if (!['coach', 'committee', 'membership', 'finance', 'webmaster'].includes(role)) {
      router.replace('/dashboard'); return
    }
    loadSessions()
  }, [router])

  async function loadSessions() {
    setLoading(true)
    try {
      const data = await api.get<AttendanceSession[]>('/attendance/sessions')
      setSessions(data)
    } catch { }
    finally { setLoading(false) }
  }

  function openSheet(sessionId: number) {
    router.push(`/attendance/${sessionId}`)
  }

  const calendarDays = getDaysInMonth(monthYear.year, monthYear.month)

  function getSessionsForDay(day: Date) {
    return sessions.filter(s => sameDay(new Date(s.startTime), day))
  }

  const monthLabel = new Date(monthYear.year, monthYear.month)
    .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  const past = sessions.filter(s => isPast(s.startTime))
  const upcoming = sessions.filter(s => !isPast(s.startTime))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'list' ? 'Past 7 days and next 7 days' : monthLabel}
          </p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['list', 'month'] as ViewMode[]).map(mode => (
            <button key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                viewMode === mode ? 'text-white' : 'text-gray-600 bg-white hover:bg-gray-50'
              }`}
              style={viewMode === mode ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              {mode === 'list' ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  List
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Month
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
        </div>
      ) : (
        <>
          {/* ── List View ─────────────────────────────────────────────── */}
          {viewMode === 'list' && (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Upcoming
                  </h2>
                  <div className="space-y-3">
                    {upcoming.map(s => (
                      <SessionAttendanceCard key={s.id} session={s} onClick={() => openSheet(s.id)} />
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Past Sessions
                  </h2>
                  <div className="space-y-3">
                    {[...past].reverse().map(s => (
                      <SessionAttendanceCard key={s.id} session={s} onClick={() => openSheet(s.id)} />
                    ))}
                  </div>
                </div>
              )}

              {sessions.length === 0 && (
                <div className="card p-12 text-center">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="text-sm font-medium text-gray-600">No sessions in this window</p>
                  <p className="text-xs text-gray-400 mt-1">Sessions from the past 7 days and next 7 days appear here</p>
                </div>
              )}
            </div>
          )}

          {/* ── Month View ────────────────────────────────────────────── */}
          {viewMode === 'month' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={() => setMonthYear(({ year, month }) =>
                  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
                )} className="btn-secondary p-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="font-semibold text-gray-900">{monthLabel}</h2>
                <button onClick={() => setMonthYear(({ year, month }) =>
                  month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
                )} className="btn-secondary p-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 border-b border-gray-100">
                {WEEKDAYS.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const isToday = day && sameDay(day, now)
                  const daySessions = day ? getSessionsForDay(day) : []

                  return (
                    <div key={idx} className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 ${!day ? 'bg-gray-50' : 'bg-white'}`}>
                      {day && (
                        <>
                          <div className="flex justify-center mb-1">
                            <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                              isToday ? 'text-white' : 'text-gray-600'
                            }`} style={isToday ? { backgroundColor: 'var(--color-primary)' } : {}}>
                              {day.getDate()}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {daySessions.map(s => (
                              <button key={s.id} onClick={() => openSheet(s.id)}
                                className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate hover:opacity-80 text-white"
                                style={{ backgroundColor: s.markedCount > 0 && s.markedCount >= s.bookedCount ? '#16a34a' : 'var(--color-primary)' }}
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

              <div className="p-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-primary)' }} />
                  Pending
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-600" />
                  Marked
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SessionAttendanceCard({
  session: s,
  onClick,
}: {
  session: AttendanceSession
  onClick: () => void
}) {
  const isPastSession = new Date(s.startTime) < new Date()
  const allMarked = s.markedCount >= s.bookedCount && s.bookedCount > 0
  const partiallyMarked = s.markedCount > 0 && s.markedCount < s.bookedCount

  return (
    <button onClick={onClick} className="card p-4 flex items-center gap-4 w-full text-left hover:shadow-md transition-shadow">
      {/* Date block */}
      <div className="flex-shrink-0 w-14 text-center">
        <div className="text-xs font-semibold uppercase text-gray-400">
          {new Date(s.startTime).toLocaleDateString('en-AU', { weekday: 'short' })}
        </div>
        <div className="text-2xl font-bold text-gray-900 leading-none">
          {new Date(s.startTime).getDate()}
        </div>
        <div className="text-xs text-gray-400">
          {new Date(s.startTime).toLocaleDateString('en-AU', { month: 'short' })}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{s.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
          <span>🕐 {new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          {s.locationName && <span>📍 {s.locationName}</span>}
          {s.coachName && <span>👤 {s.coachName}</span>}
        </div>
      </div>

      {/* Attendance status */}
      <div className="flex-shrink-0 text-right">
        <div className={`text-sm font-bold ${allMarked ? 'text-green-600' : partiallyMarked ? 'text-amber-600' : 'text-gray-400'}`}>
          {s.markedCount}/{s.bookedCount}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {allMarked ? '✓ Complete' : partiallyMarked ? 'In progress' : isPastSession ? 'Not started' : 'Upcoming'}
        </div>
      </div>

      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}