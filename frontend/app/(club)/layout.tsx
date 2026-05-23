import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getClubConfig, buildCssVariables } from '@/lib/club-config'
import ClubNav from '@/components/layout/ClubNav'
import MembersGuildContactForm from '@/components/MembersGuildContactForm'
import { PwaRegistration } from '@/components/PwaRegistration'
import { PlatformLandingPage } from '@/components/PlatformLandingPage' 

export async function generateMetadata() {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)

  return {
    title: config?.displayName ?? 'MembersGuild',
    manifest: '/api/manifest',
    appleWebApp: {
      capable:        true,
      statusBarStyle: 'default',
      title:          config?.displayName ?? 'MembersGuild',
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  }
}

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)

  if (!config) return <PlatformLandingPage />

  const cssVars = buildCssVariables(config)

  return (
    <>
      <PwaRegistration />
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ClubNav config={config} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <div className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {config.displayName} · Powered by{' '}
          <a href="https://membersguild.com.au" className="hover:underline">MembersGuild</a>
          {' '}·{' '}
          <a href="/support" className="hover:underline">Help & Support</a>  {/* ← add */}
        </div>
      </div>
    </>
  )
}

