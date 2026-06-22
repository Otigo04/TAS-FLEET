import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { requireSuperadmin } from '@/lib/superadmin'
import { getUserCompanies } from '@/lib/tenant'
import { LogoutButton } from '@/components/portal/logout-button'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin()

  // Only offer "Zum Portal" when this superadmin is actually a member of at
  // least one company — otherwise /dashboard just bounces back here.
  const companies = await getUserCompanies()
  const hasPortalAccess = companies.length > 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
                Plattform-Administration
              </p>
              <h1 className="text-lg font-bold tracking-tight">Superadmin Konsole</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPortalAccess && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Zum Portal
              </Link>
            )}
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>

        <footer className="border-t border-white/10 px-6 py-3 text-center text-xs uppercase tracking-widest text-slate-500">
          © ORYON FLEET V0.7 · ORYON SYSTEMS · Superadmin
        </footer>
      </div>
    </div>
  )
}
