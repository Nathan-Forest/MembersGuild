'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ClubConfig, UserRole } from '@/types'
import { getCurrentUser, logout } from '@/lib/auth'
import { canManageSessions, canManageCredits, isStaff } from '@/types'

interface Props {
  config: ClubConfig
}

interface NavItem {
  label: string
  href: string
  roles?: UserRole[]  // undefined = all roles
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Calendar', href: '/calendar', roles: undefined },
  { label: 'My Sessions', href: '/my-sessions' },
  { label: 'Training', href: '/training' },
  { label: 'Swim Shop', href: '/shop', roles: ['member', 'coach', 'committee', 'membership', 'finance', 'webmaster'] },
  { label: 'My Orders', href: '/my-orders', roles: ['member', 'committee', 'membership', 'finance', 'webmaster'] },
  { label: 'My Account', href: '/my-account', roles: ['cats', 'member', 'committee', 'membership', 'finance', 'webmaster'] },
  { label: 'Attendance', href: '/attendance', roles: ['coach', 'committee', 'membership', 'finance', 'webmaster'] },
  { label: 'Members', href: '/members', roles: ['coach', 'committee', 'membership', 'finance', 'webmaster'] },
]

const MANAGEMENT_ITEMS: NavItem[] = [
  { label: 'Sessions', href: '/management/sessions', roles: ['coach', 'committee', 'webmaster'] },
  { label: 'Locations', href: '/management/locations', roles: ['webmaster'] },
  { label: 'Training', href: '/management/training', roles: ['coach', 'committee', 'webmaster'] },
  { label: 'Credits', href: '/management/credits', roles: ['finance', 'webmaster'] },
  { label: 'Shop', href: '/management/shop', roles: ['finance', 'webmaster'] },
  { label: 'Shop Orders', href: '/management/orders', roles: ['finance', 'webmaster'] },
  { label: 'Site Settings', href: '/management/settings', roles: ['webmaster'] },
]

export default function ClubNav({ config }: Props) {
  const pathname = usePathname()
  const [role, setRole] = useState<UserRole | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mgmtOpen, setMgmtOpen] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (user) setRole(user.role as UserRole)
  }, [])

  const canSee = (item: NavItem) => {
    if (!item.roles) return true
    if (!role) return false
    return item.roles.includes(role)
  }

  const visibleNav = NAV_ITEMS.filter(canSee)
  const visibleMgmt = MANAGEMENT_ITEMS.filter(canSee)
  const showMgmt = visibleMgmt.length > 0

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="bg-gray-900 shadow-sm sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo + club name */}
          <Link href="/dashboard" className="flex items-center gap-3 flex-shrink-0">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={config.displayName} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {config.displayName.charAt(0)}
              </div>
            )}
            <span className="text-white font-semibold text-sm hidden sm:block">
              {config.displayName}
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {visibleNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive(item.href)
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                style={isActive(item.href) ? { backgroundColor: 'var(--color-primary)' } : {}}
              >
                {item.label}
              </Link>
            ))}

            {/* Management dropdown */}
            {showMgmt && (
              <div className="relative">
                <button
                  onClick={() => setMgmtOpen(o => !o)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Management
                  <svg className={`w-4 h-4 transition-transform ${mgmtOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {mgmtOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMgmtOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                      {visibleMgmt.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMgmtOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${isActive(item.href)
                              ? 'text-white font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          style={isActive(item.href) ? { backgroundColor: 'var(--color-primary)' } : {}}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side: avatar + logout */}
          <div className="flex items-center gap-2">
            <Link
              href="/my-profile"
              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: 'var(--color-primary)' }}
              title="My Profile"
            >
              {role?.charAt(0).toUpperCase() ?? '?'}
            </Link>

            <button
              onClick={logout}
              className="hidden sm:block text-xs text-gray-400 hover:text-white transition-colors px-2 py-1"
            >
              Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden text-gray-300 hover:text-white p-1"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-gray-800 py-3 space-y-1">
            {visibleNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${isActive(item.href) ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                style={isActive(item.href) ? { backgroundColor: 'var(--color-primary)' } : {}}
              >
                {item.label}
              </Link>
            ))}
            {showMgmt && (
              <>
                <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                  Management
                </div>
                {visibleMgmt.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            )}
            <button
              onClick={logout}
              className="block w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
