'use client'

import Link from 'next/link'

interface ChangeEntry {
  type: 'new' | 'fixed' | 'improved'
  text: string
}

interface Release {
  version: string
  date: string
  label?: string
  summary?: string
  changes: ChangeEntry[]
}

const RELEASES: Release[] = [
  {
    version: 'June 2026',
    date: '6 June 2026',
    label: 'Latest',
    summary: 'Attendance improvements, billing fixes, and a smoother onboarding experience.',
    changes: [
      { type: 'new',      text: 'Attendance report recipients — save named contacts (e.g. President, Secretary) in Site Settings and tick them when sending a report' },
      { type: 'new',      text: 'What\'s New page — release notes are now visible to all members' },
      { type: 'fixed',    text: 'Attendance report emails now show the correct Brisbane date and time instead of UTC' },
      { type: 'fixed',    text: 'Recurring sessions now created on the correct day of the week' },
      { type: 'fixed',    text: 'Session times now display correctly in Brisbane local time throughout the portal' },
      { type: 'improved', text: 'Attendance list now sorted soonest upcoming at top, most recent past at top' },
      { type: 'fixed',    text: 'Custom roles (e.g. Club Captain) now correctly show all menu items based on inherited permissions' },
      { type: 'fixed',    text: 'Club portal data now correctly isolated between clubs — no cross-club data leakage' },
      { type: 'new',      text: 'Webmaster can now reset a member\'s password directly from the admin panel' },
      { type: 'new',      text: 'Webmaster can now disable or enable a member\'s account' },
      { type: 'improved', text: 'Welcome email now includes getting started steps and support contact details' },
    ],
  },
  {
    version: 'v1.0',
    date: 'May 2026',
    label: 'Launch',
    summary: 'MembersGuild goes live. The platform for community sports clubs.',
    changes: [
      { type: 'new', text: 'Session calendar — browse, book and manage training sessions' },
      { type: 'new', text: 'Credit system — purchase credit packs and use them to book sessions' },
      { type: 'new', text: 'Attendance tracking — mark attendance, handle walk-ins, QR code check-in' },
      { type: 'new', text: 'Shop — credit packs and merchandise with bank transfer payment' },
      { type: 'new', text: 'Training & Personal Bests — log times and track improvement over time' },
      { type: 'new', text: 'CATS (Come And Try) — public sign-up flow for trial members' },
      { type: 'new', text: 'Member management — add members, assign roles, manage credits' },
      { type: 'new', text: 'Club News — post updates visible to all members on their dashboard' },
      { type: 'new', text: 'Custom roles — create club-specific roles with inherited permissions' },
      { type: 'new', text: 'Site Settings — configure branding, timezone, welcome email and more' },
      { type: 'new', text: 'PWA support — install the portal as an app on iOS and Android' },
    ],
  },
]

const TYPE_CONFIG = {
  new:      { label: 'New',      bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
  fixed:    { label: 'Fixed',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  improved: { label: 'Improved', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
}

export default function WhatsNewPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">

      {/* Header */}
      <div className="pt-6">
        <Link href="/support"
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Support
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">What's New</h1>
        <p className="text-gray-500 mt-2">
          The latest updates, fixes and improvements to your club portal.
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Releases */}
      <div className="space-y-8">
        {RELEASES.map((release, i) => (
          <div key={i} className="card overflow-hidden">

            {/* Release header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900">{release.version}</h2>
                  {release.label && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      release.label === 'Latest'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                    style={release.label === 'Latest'
                      ? { backgroundColor: 'var(--color-primary)' }
                      : {}}>
                      {release.label}
                    </span>
                  )}
                </div>
                {release.summary && (
                  <p className="text-sm text-gray-500">{release.summary}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-1">
                {release.date}
              </span>
            </div>

            {/* Changes */}
            <div className="divide-y divide-gray-50">
              {release.changes.map((change, j) => {
                const cfg = TYPE_CONFIG[change.type]
                return (
                  <div key={j} className="flex items-start gap-3 px-6 py-3.5">
                    <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{change.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="text-center pb-4">
        <p className="text-xs text-gray-400">
          Powered by MembersGuild · Updates delivered automatically
        </p>
      </div>

    </div>
  )
}