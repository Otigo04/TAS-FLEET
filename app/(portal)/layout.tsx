import { Sidebar } from '@/components/portal/sidebar'
import { LogoutButton } from '@/components/portal/logout-button'
import { requireUser } from '@/lib/auth'
import { CompanyLogo } from '@/components/branding/company-logo'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser()

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
        <Sidebar />

        <div className="flex flex-1 flex-col">
          <header className="surface-card animate-fade-up mx-4 mt-4 flex items-center justify-between rounded-2xl px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Angemeldet als</p>
              <p className="text-sm font-semibold text-slate-900">{user.email}</p>
            </div>
            <LogoutButton />
          </header>

          <div className="animate-fade-up-delay flex-1 p-6">{children}</div>

          <footer className="mx-6 mb-6 mt-auto flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500">
            <CompanyLogo compact className="scale-90" />
            <p>Copyright © Yakup Orhan Tas. Alle Rechte vorbehalten.</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
