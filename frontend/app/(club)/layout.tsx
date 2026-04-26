import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getClubConfig, buildCssVariables } from '@/lib/club-config'
import ClubNav from '@/components/layout/ClubNav'
import type { ClubConfig } from '@/types'

interface ClubLayoutProps {
  children: React.ReactNode
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)

  return {
    title: config ? `${config.displayName} | MembersGuild` : 'MembersGuild',
    manifest: '/manifest.json',
    themeColor: config?.primaryColor ?? '#1a56db',
  }
}

export default async function ClubLayout({ children }: ClubLayoutProps) {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''

  const config = await getClubConfig(host)

  if (!config) {
    redirect('https://membersguild.com.au')
  }

  const cssVars = buildCssVariables(config)

  return (
    <>
      {/* Inject per-club CSS variables — this is how white-labelling works */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />

      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ClubNav config={config} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {config.displayName} · Powered by{' '}
          <a href="https://membersguild.com.au" className="hover:underline">MembersGuild</a>
        </footer>
      </div>
    </>
  )
}
