import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/portal/sidebar'
import { LogoutButton } from '@/components/portal/logout-button'
import { GlobalSearch } from '@/components/portal/global-search'
import { requireCompletedUser } from '@/lib/auth'
import { UserAvatar } from '@/components/branding/user-avatar'
import { getUserCompanies, resolveActiveCompany } from '@/lib/tenant'
import { getCurrentSuperadmin } from '@/lib/superadmin'
import { TenantProvider } from '@/components/portal/tenant-provider'
import { CompanySwitcher } from '@/components/portal/company-switcher'
import { PresenceIndicator } from '@/components/portal/presence-indicator'
import { ThemeToggle } from '@/components/portal/theme-toggle'
import { MobileBottomNav } from '@/components/portal/mobile-bottom-nav'
import { NotificationBell } from '@/components/portal/notification-bell'
import { MobileNavProvider, MobileNavTrigger } from '@/components/portal/mobile-nav'
import { ViewModeProvider } from '@/components/portal/view-mode-provider'
import { ViewModeSlider } from '@/components/portal/view-mode-slider'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireCompletedUser()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email || 'Unbekannt'
  const avatarUrl = profile?.avatar_url ?? null

  const [{ isSuperadmin }, companies] = await Promise.all([
    getCurrentSuperadmin(),
    getUserCompanies(),
  ])
  const activeCompany = await resolveActiveCompany(companies)
  if (!activeCompany) {
    redirect(isSuperadmin ? '/superadmin' : '/no-company')
  }

  return (
    <TenantProvider activeCompany={activeCompany} companies={companies} isSuperadmin={isSuperadmin}>
     <ViewModeProvider>
     <MobileNavProvider displayName={displayName} avatarUrl={avatarUrl} isSuperadmin={isSuperadmin}>
      <PresenceIndicator userId={user.id} displayName={displayName} avatarUrl={avatarUrl} />
      <div className="vm-root-pad min-h-screen flex flex-col pb-16 lg:pb-0">
        <div className="no-print bg-slate-900 text-slate-300 py-1.5 px-4 text-xs text-center">
          <span className="font-semibold text-brand-300">TAS FLEET</span>
          <span className="text-slate-500 dark:text-slate-400"> · v0.9.39 · TAS WEBWORKS</span>
        </div>
        <div className="vm-shell mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:flex-row">
          <div className="vm-sidebar no-print hidden lg:block">
            <Sidebar displayName={displayName} avatarUrl={avatarUrl} isSuperadmin={isSuperadmin} />
          </div>

          <div className="flex flex-1 flex-col min-w-0">
            <header className="no-print surface-card mx-2 mt-2 sm:mx-4 sm:mt-4 flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <MobileNavTrigger />

                <div className="hidden sm:block">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Angemeldet als</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
                </div>
              </div>

              <GlobalSearch />

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="hidden sm:inline-flex"><ThemeToggle /></span>
                <NotificationBell userId={user.id} />
                <span className="hidden sm:inline-flex"><ViewModeSlider /></span>
                <CompanySwitcher />
                <UserAvatar avatarUrl={avatarUrl} name={displayName} size="md" className="hidden sm:inline-flex" />
                <LogoutButton />
              </div>
            </header>

            <div className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0">{children}</div>

            <footer className="no-print hidden sm:flex mx-4 sm:mx-6 mb-4 sm:mb-6 mt-auto items-center justify-between rounded-md border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <UserAvatar avatarUrl={avatarUrl} name={displayName} size="sm" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">TAS FLEET</span>
              </div>
              <p>Angemeldet als {displayName}</p>
            </footer>
          </div>
        </div>
      </div>

      <MobileBottomNav />
     </MobileNavProvider>
     </ViewModeProvider>
    </TenantProvider>
  )
}
