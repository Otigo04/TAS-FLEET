import { Sidebar } from '@/components/portal/sidebar'
import { MobileSidebar } from '@/components/portal/mobile-sidebar'
import { LogoutButton } from '@/components/portal/logout-button'
import { requireCompletedUser } from '@/lib/auth'
import { CompanyLogo } from '@/components/branding/company-logo'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireCompletedUser()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email || 'Unbekannt'

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
        <div className="hidden lg:block">
          <Sidebar displayName={displayName} />
        </div>

        <div className="flex flex-1 flex-col">
          <header className="surface-card animate-fade-up mx-4 mt-4 flex items-center justify-between rounded-xl px-6 py-4">
            <div className="flex items-center gap-3">
              <MobileSidebar displayName={displayName} />

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Angemeldet als</p>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CompanyLogo compact className="hidden sm:inline-flex" />
              <LogoutButton />
            </div>
          </header>

          <div className="animate-fade-up-delay flex-1 p-6">{children}</div>

          <footer className="mx-6 mb-6 mt-auto flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <CompanyLogo compact className="scale-90" />
            <p>Angemeldet als {displayName}</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
