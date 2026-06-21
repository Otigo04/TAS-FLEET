import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/portal/sidebar'
import { MobileSidebar } from '@/components/portal/mobile-sidebar'
import { LogoutButton } from '@/components/portal/logout-button'
import { GlobalSearch } from '@/components/portal/global-search'
import { requireCompletedUser } from '@/lib/auth'
import { CompanyLogo } from '@/components/branding/company-logo'
import { getUserCompanies, resolveActiveCompany } from '@/lib/tenant'
import { getCurrentSuperadmin } from '@/lib/superadmin'
import { TenantProvider } from '@/components/portal/tenant-provider'
import { CompanySwitcher } from '@/components/portal/company-switcher'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireCompletedUser()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email || 'Unbekannt'

  // Resolve the tenant context. Companies are created by superadmins only;
  // a regular user with no company sees an info page, a superadmin without a
  // company goes straight to the platform console.
  const { isSuperadmin } = await getCurrentSuperadmin()
  const companies = await getUserCompanies()
  const activeCompany = await resolveActiveCompany(companies)
  if (!activeCompany) {
    redirect(isSuperadmin ? '/superadmin' : '/no-company')
  }

  return (
    <TenantProvider activeCompany={activeCompany} companies={companies}>
      <div className="min-h-screen flex flex-col">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-1.5 px-4 text-xs font-semibold tracking-[0.2em] text-center uppercase">
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">YOT FLEET V0.6</span>
          <span className="text-slate-400"> · YOT SOLUTIONS · Work in Progress</span>
        </div>
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:flex-row">
          <div className="hidden lg:block">
            <Sidebar displayName={displayName} isSuperadmin={isSuperadmin} />
          </div>

          <div className="flex flex-1 flex-col">
            <header className="surface-card animate-fade-up mx-4 mt-4 flex items-center justify-between rounded-xl px-6 py-4 gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <MobileSidebar displayName={displayName} isSuperadmin={isSuperadmin} />

                <div className="hidden sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Angemeldet als</p>
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                </div>
              </div>

              <GlobalSearch />

              <div className="flex items-center gap-2 shrink-0">
                <CompanySwitcher />
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
    </TenantProvider>
  )
}
