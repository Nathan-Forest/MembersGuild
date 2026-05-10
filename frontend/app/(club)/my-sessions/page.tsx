'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface UpcomingSession {
  id: number
  title: string
  description: string | null
  locationName: string | null
  coachName: string | null
  startTime: string
  endTime: string
  capacity: number
  creditCost: number
  registrationCutoffHours: number
  bookedCount: number
  isBooked: boolean
}

interface PastSession {
  sessionId: number
  sessionTitle: string
  startTime: string
  locationName: string | null
  coachName: string | null
}

interface MySessionsData {
  stats: {
    upcomingBookings: number
    thisMonthSessions: number
    lifetimeSessions: number
  }
  upcoming: UpcomingSession[]
  past: PastSession[]
}

export default function MySessionsPage() {
  const router = useRouter()
  const [data, setData] = useState<MySessionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [unbookingId, setUnbookingId] = useState<number | null>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentRole(user.role as UserRole)
    loadData()
  }, [router])

  async function loadData() {
    setLoading(true)
    try {
      const result = await api.get<MySessionsData>('/sessions/my-sessions')
      setData(result)
    } catch { }
    finally { setLoading(false) }
  }

  async function handleUnbook(sessionId: number) {
    if (!confirm('Unregister from this session? Your credit will be refunded.')) return
    setUnbookingId(sessionId)
    try {
      await api.delete(`/sessions/${sessionId}/book`)
      await loadData()
    } catch { }
    finally { setUnbookingId(null) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">My Sessions</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="card p-4 h-24 animate-pulse bg-gray-100" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const upcoming = data?.upcoming ?? []
  const past = data?.past ?? []

  return (
    <div className="space-y-8">
      <h1 className="page-title">My Sessions</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Upcoming Bookings
          </p>
          <p className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {stats?.upcomingBookings ?? 0}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Sessions This Month
          </p>
          <p className="text-4xl font-bold text-green-600">
            {stats?.thisMonthSessions ?? 0}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Lifetime Sessions
          </p>
          <p className="text-4xl font-bold text-gray-700">
            {stats?.lifetimeSessions ?? 0}
          </p>
        </div>
      </div>

      {/* Upcoming Bookings */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Upcoming Bookings — {upcoming.length}
        </h2>

        {upcoming.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm font-medium text-gray-600">No upcoming bookings</p>
            <p className="text-xs text-gray-400 mt-1">Head to the calendar to register for sessions</p>
            <button
              onClick={() => router.push('/calendar')}
              className="btn-primary px-6 py-2 mt-4"
            >
              View Calendar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(s => {
              const cutoffPassed = Date.now() > new Date(s.startTime).getTime() - s.registrationCutoffHours * 60 * 60 * 1000

              return (
                <div key={s.id} className="card p-4 flex items-center gap-4">
                  {/* Date block */}
                  <div
                    className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <span className="text-xs font-semibold uppercase">
                      {new Date(s.startTime).toLocaleDateString('en-AU', { month: 'short' })}
                    </span>
                    <span className="text-2xl font-bold leading-none">
                      {new Date(s.startTime).getDate()}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{s.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span>
                        🕐 {new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        {' – '}
                        {new Date(s.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                      {s.locationName && <span>📍 {s.locationName}</span>}
                      {s.coachName && <span>👤 {s.coachName}</span>}
                      <span className="text-green-700 font-medium">✓ Registered</span>
                    </div>
                  </div>

                  {/* Unregister */}
                  {!cutoffPassed ? (
                    <button
                      onClick={() => handleUnbook(s.id)}
                      disabled={unbookingId === s.id}
                      className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
                    >
                      {unbookingId === s.id ? '…' : 'Unregister'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 flex-shrink-0">Locked in</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Session History */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Session History — {past.length}
        </h2>

        {past.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-3xl mb-2">🏊</p>
            <p className="text-sm font-medium text-gray-600">No session history yet</p>
            <p className="text-xs text-gray-400 mt-1">Your past sessions will appear here</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Coach</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map(s => (
                  <tr key={s.sessionId}>
                    <td className="font-medium text-gray-900">{s.sessionTitle}</td>
                    <td className="text-gray-600">
                      <div>{new Date(s.startTime).toLocaleDateString('en-AU', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(s.startTime).toLocaleTimeString('en-AU', {
                          hour: '2-digit', minute: '2-digit', hour12: false
                        })}
                      </div>
                    </td>
                    <td className="text-gray-600">{s.locationName ?? '—'}</td>
                    <td className="text-gray-600">{s.coachName ?? '—'}</td>
                    <td>
                      <span className="badge badge-gray text-xs">Attended</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {past.length > 0 && (
          <p className="text-xs text-gray-400 text-right mt-2">
            Showing last {past.length} sessions · Attendance status added in Phase 4
          </p>
        )}
      </div>
    </div>
  )
}