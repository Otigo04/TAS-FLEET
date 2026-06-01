import { Sidebar } from '@/components/portal/sidebar'
import { LogoutButton } from '@/components/portal/logout-button'
import { requireUser } from '@/lib/auth'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser()

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
        <Sidebar />

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Angemeldet als</p>
              <p className="text-sm font-semibold text-slate-900">{user.email}</p>
            </div>
            <LogoutButton />
          </header>

          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
