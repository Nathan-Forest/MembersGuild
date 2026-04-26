'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser, requireAuth } from '@/lib/auth'
import { ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

export default function DashboardPage() {
  const [user, setUser] = useState<{ firstName: string; role: UserRole } | null>(null)

  useEffect(() => {
    requireAuth()
    const u = getCurrentUser()
    if (u) setUser({ firstName: 'Member', role: u.role as UserRole })
  }, [])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">
          Welcome back{user.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {ROLE_LABELS[user.role]} account
        </p>
      </div>

      {/* Quick stats - will be populated once API endpoints are wired */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Credits', value: '—', color: 'blue' },
          { label: 'Sessions this month', value: '—', color: 'green' },
          { label: 'Upcoming bookings', value: '—', color: 'indigo' },
          { label: 'Lifetime sessions', value: '—', color: 'purple' },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming sessions placeholder */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Upcoming Sessions</h2>
        <p className="text-sm text-gray-400">No upcoming sessions. Check the calendar to register.</p>
      </div>
    </div>
  )
}
