import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { requireSuperadmin } from '@/lib/superadmin'
import { getUserCompanies } from '@/lib/tenant'
import { LogoutButton } from '@/components/portal/logout-button'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSuperadmin()
  } catch (err) {
    // `redirect()` inside requireSuperadmin() throws internally too — let
    // that pass through untouched, Next.js handles it.
    if (err && typeof err === 'object' && 'digest' in err && String(err.digest).startsWith('NEXT_REDIRECT')) {
      throw err
    }
    // Anything else here (e.g. missing SUPABASE_SERVICE_ROLE_KEY on the
    // deployment) would otherwise surface as a bare, undiagnosable "server
    // error occurred" page. Show the real message instead.
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">
            Superadmin-Konsole nicht erreichbar
          </p>
          <p className="mt-2 text-sm text-slate-200">
            {err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden der Superadmin-Konsole.'}
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Pruefe in Vercel unter Project Settings → Environment Variables (Production), ob
            SUPABASE_SERVICE_ROLE_KEY gesetzt ist, und deploye danach neu.
          </p>
        </div>
      </div>
    )
  }

  // Only offer "Zum Portal" when this superadmin is actually a member of at
  // least one company — otherwise /dashboard just bounces back here.
  const companies = await getUserCompanies()
  const hasPortalAccess = companies.length > 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500 text-slate-950">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
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

        <footer className="border-t border-white/10 px-6 py-3 text-center text-xs text-slate-500">
          © TAS FLEET v0.7 · TAS WEBWORKS · Superadmin
        </footer>
      </div>
    </div>
  )
}
