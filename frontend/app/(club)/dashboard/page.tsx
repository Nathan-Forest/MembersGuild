'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, authApi } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

interface DashboardStats {
  creditBalance?: number
  sessionsThisMonth: number
  upcomingBookings: number
  lifetimeSessions: number
  upcomingSessions: {
    id: number
    title: string
    startTime: string
    location?: string
    creditCost: number
  }[]
}

interface ClubUpdate {
  id: number
  title: string
  content: string
  authorName: string
  createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [firstName, setFirstName]   = useState('')
  const [role, setRole]             = useState<UserRole | ''>('')
  const [stats, setStats]           = useState<DashboardStats | null>(null)
  const [updates, setUpdates]       = useState<ClubUpdate[]>([])
  const [updateIndex, setUpdateIndex] = useState(0)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) { router.replace('/login'); return }
    setRole(u.role as UserRole)

    const noCredits = u.role === 'coach'

    Promise.all([
      authApi.profile(),
      api.get<DashboardStats>('/sessions/my-sessions').catch(() => null),
      noCredits ? Promise.resolve(null) : api.get<{ creditBalance: number }>('/credits/my-account').catch(() => null),
      api.get<ClubUpdate[]>('/updates').catch(() => []),
    ]).then(([profile, sessionData, creditData, clubUpdates]) => {
      setFirstName(profile.firstName)
      setStats({
        creditBalance:     creditData?.creditBalance,
        sessionsThisMonth: sessionData?.sessionsThisMonth ?? 0,
        upcomingBookings:  sessionData?.upcomingBookings ?? 0,
        lifetimeSessions:  sessionData?.lifetimeSessions ?? 0,
        upcomingSessions:  sessionData?.upcomingSessions ?? [],
      })
      setUpdates(clubUpdates as ClubUpdate[])
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [router])

  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : ''
  const currentUpdate = updates[updateIndex]

  if (loading) return (
    <div className="space-y-6">
      <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div>
        <h1 className="page-title">Welcome back, {firstName}!</h1>
        <p className="mt-1 text-sm text-gray-500">{roleLabel} account</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {role !== 'coach' && (
          <div className="card p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Credits</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {stats?.creditBalance ?? '—'}
            </p>
            {stats?.creditBalance === 0 && (
              <p className="text-xs text-red-500 mt-0.5">None remaining</p>
            )}
            {(stats?.creditBalance ?? 0) <= 2 && (stats?.creditBalance ?? 0) > 0 && (
              <p className="text-xs text-amber-500 mt-0.5">Running low</p>
            )}
          </div>
        )}
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sessions This Month</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.sessionsThisMonth ?? '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upcoming Bookings</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.upcomingBookings ?? '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lifetime Sessions</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.lifetimeSessions ?? '—'}</p>
        </div>
      </div>

      {/* Club Update */}
      {updates.length > 0 && currentUpdate && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"
            style={{ backgroundColor: 'var(--color-primary)', opacity: 0.95 }}>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">📢 Club Update</span>
              {updates.length > 1 && (
                <span className="text-white/60 text-xs">
                  {updateIndex + 1} of {updates.length}
                </span>
              )}
            </div>
            {updates.length > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setUpdateIndex(i => Math.min(i + 1, updates.length - 1))}
                  disabled={updateIndex >= updates.length - 1}
                  className="text-white/70 hover:text-white disabled:opacity-30 text-xs px-2 py-0.5 rounded">
                  ← Older
                </button>
                <button
                  onClick={() => setUpdateIndex(i => Math.max(i - 1, 0))}
                  disabled={updateIndex === 0}
                  className="text-white/70 hover:text-white disabled:opacity-30 text-xs px-2 py-0.5 rounded">
                  Newer →
                </button>
              </div>
            )}
          </div>
          <div className="p-5 space-y-2">
            {currentUpdate.title && (
              <h3 className="font-semibold text-gray-900">{currentUpdate.title}</h3>
            )}
            <p className="text-sm text-gray-700 leading-relaxed">{currentUpdate.content}</p>
            <p className="text-xs text-gray-400">
              Posted by {currentUpdate.authorName} · {new Date(currentUpdate.createdAt).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Upcoming Sessions</h2>
        {!stats?.upcomingSessions?.length ? (
          <p className="text-sm text-gray-400">
            No upcoming sessions.{' '}
            <a href="/calendar" className="text-[var(--color-primary)] hover:underline">
              Check the calendar to register.
            </a>
          </p>
        ) : (
          <div className="space-y-3">
            {stats.upcomingSessions.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.startTime).toLocaleDateString('en-AU', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                    {s.location && ` · ${s.location}`}
                  </p>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  🪙 {s.creditCost}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}