import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/portal/sidebar'
import { MobileSidebar } from '@/components/portal/mobile-sidebar'
import { LogoutButton } from '@/components/portal/logout-button'
import { GlobalSearch } from '@/components/portal/global-search'
import { requireCompletedUser } from '@/lib/auth'
import { UserAvatar } from '@/components/branding/user-avatar'
import { getUserCompanies, resolveActiveCompany } from '@/lib/tenant'
import { getCurrentSuperadmin } from '@/lib/superadmin'
import { TenantProvider } from '@/components/portal/tenant-provider'
import { CompanySwitcher } from '@/components/portal/company-switcher'
import { PresenceIndicator } from '@/components/portal/presence-indicator'
import { MobileBottomNavWrapper } from '@/components/portal/mobile-bottom-nav-wrapper'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireCompletedUser()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email || 'Unbekannt'
  const avatarUrl = profile?.avatar_url ?? null

  const { isSuperadmin } = await getCurrentSuperadmin()
  const companies = await getUserCompanies()
  const activeCompany = await resolveActiveCompany(companies)
  if (!activeCompany) {
    redirect(isSuperadmin ? '/superadmin' : '/no-company')
  }

  return (
    <TenantProvider activeCompany={activeCompany} companies={companies} isSuperadmin={isSuperadmin}>
      <PresenceIndicator userId={user.id} displayName={displayName} avatarUrl={avatarUrl} />
      <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
        <div className="no-print bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-1.5 px-4 text-xs font-semibold tracking-[0.2em] text-center uppercase">
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">YOT FLEET V0.6</span>
          <span className="text-slate-400"> · YOT SOLUTIONS · Work in Progress</span>
        </div>
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:flex-row">
          <div className="no-print hidden lg:block">
            <Sidebar displayName={displayName} avatarUrl={avatarUrl} isSuperadmin={isSuperadmin} />
          </div>

          <div className="flex flex-1 flex-col min-w-0">
            <header className="no-print surface-card animate-fade-up mx-2 mt-2 sm:mx-4 sm:mt-4 flex items-center justify-between rounded-xl px-3 py-3 sm:px-6 sm:py-4 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <MobileSidebar displayName={displayName} avatarUrl={avatarUrl} isSuperadmin={isSuperadmin} />

                <div className="hidden sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Angemeldet als</p>
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                </div>
              </div>

              <GlobalSearch />

              <div className="flex items-center gap-2 shrink-0">
                <CompanySwitcher />
                <UserAvatar avatarUrl={avatarUrl} name={displayName} size="md" className="hidden sm:inline-flex" />
                <LogoutButton />
              </div>
            </header>

            <div className="animate-fade-up-delay flex-1 p-3 sm:p-4 lg:p-6 min-w-0">{children}</div>

            <footer className="no-print hidden sm:flex mx-4 sm:mx-6 mb-4 sm:mb-6 mt-auto items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <UserAvatar avatarUrl={avatarUrl} name={displayName} size="sm" />
                <span className="font-semibold uppercase tracking-[0.22em] text-emerald-600">YOT FLEET</span>
              </div>
              <p>Angemeldet als {displayName}</p>
            </footer>
          </div>
        </div>
      </div>

      <MobileBottomNavWrapper displayName={displayName} avatarUrl={avatarUrl} isSuperadmin={isSuperadmin} />
    </TenantProvider>
  )
}
