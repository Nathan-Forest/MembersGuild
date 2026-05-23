export const metadata = { title: 'MembersGuild — Platform Admin' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-[#1a2744] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-wide">MEMBERS GUILD</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-medium">
            PLATFORM ADMIN
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <a href="/admin" className="hover:text-white/70 transition-colors">Dashboard</a>
          <a href="/admin/clubs" className="hover:text-white/70 transition-colors">Clubs</a>
          <a href="/admin/health" className="hover:text-white/70 transition-colors">Health</a>
          <a href="/admin/packages" className="hover:text-white/70 transition-colors">Packages</a>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}