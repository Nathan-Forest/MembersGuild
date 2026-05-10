'use client'

import { useEffect, useState } from 'react'
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

export default function CalendarPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [bookingId, setBookingId] = useState<number | null>(null)
  const [bookingError, setBookingError] = useState<Record<number, string>>({})

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
      const now = new Date().toISOString()
      const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
      const data = await api.get<SessionResponse[]>(`/sessions?from=${now}&to=${future}`)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Upcoming sessions — next 60 days</p>
        </div>
        {creditBalance !== null && !isCoach && (
          <div
            className="rounded-xl px-4 py-2 text-white text-sm font-semibold"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {creditBalance} credit{creditBalance !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="card p-4 h-24 animate-pulse bg-gray-100" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm font-medium text-gray-600">No upcoming sessions</p>
          <p className="text-xs text-gray-400 mt-1">Check back soon or ask your coach to schedule sessions</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateKeys.map(dateLabel => (
            <div key={dateLabel}>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                />
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
                        {/* Time column */}
                        <div className="flex-shrink-0 w-16 text-center">
                          <p className="text-sm font-bold text-gray-900">
                            {new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(s.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                        </div>

                        {/* Session details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{s.title}</p>
                            {s.isBooked && (
                              <span className="badge badge-green text-xs">Registered ✓</span>
                            )}
                          </div>

                          {s.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                          )}

                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                            {s.locationName && <span>📍 {s.locationName}</span>}
                            {s.coachName && <span>👤 {s.coachName}</span>}
                            <span className={
                              isFull ? 'text-red-600 font-semibold' :
                              isLow ? 'text-amber-600 font-semibold' :
                              'text-green-700'
                            }>
                              👥 {remaining <= 0 ? 'Full' : `${remaining} spot${remaining !== 1 ? 's' : ''} left`}
                            </span>
                            {!isCoach && (
                              <span>💳 {s.creditCost} credit{s.creditCost !== 1 ? 's' : ''}</span>
                            )}
                          </div>

                          {err && (
                            <p className="text-xs text-red-600 mt-1">{err}</p>
                          )}
                        </div>

                        {/* Book button */}
                        {!isCoach && !isPast && (
                          <div className="flex-shrink-0">
                            {s.isBooked ? (
                              <button
                                onClick={() => handleUnbook(s.id)}
                                disabled={isLoading}
                                className="btn-secondary text-xs px-3 py-1.5"
                              >
                                {isLoading ? '…' : 'Unregister'}
                              </button>
                            ) : cutoffPassed ? (
                              <span className="text-xs text-gray-400">Closed</span>
                            ) : isFull ? (
                              <span className="text-xs text-red-500 font-medium">Full</span>
                            ) : (
                              <button
                                onClick={() => handleBook(s.id)}
                                disabled={isLoading}
                                className="btn-primary text-xs px-3 py-1.5"
                              >
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
      )}
    </div>
  )
}