import { redirectIfAuthenticated } from '@/lib/auth'
import { LoginForm } from '@/components/auth/login-form'
import { CompanyLogo } from '@/components/branding/company-logo'

export default async function LoginPage() {
  await redirectIfAuthenticated()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-16 top-8 h-56 w-56 rounded-full bg-teal-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-10 h-72 w-72 rounded-full bg-slate-300/30 blur-3xl" />

      <div className="animate-fade-up w-full max-w-5xl rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-2xl backdrop-blur md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <section>
            <CompanyLogo className="mb-6" />
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Flotte und Fahrer zentral steuern</h1>
            <p className="mt-4 max-w-xl text-slate-600">
              Dokumentation, Verwaltung und Realtime-Kollaboration in einem sauberen Portal fuer den
              Betriebsalltag.
            </p>
            <p className="mt-8 text-xs uppercase tracking-[0.18em] text-slate-500">
              Copyright © Yakup Orhan Tas
            </p>
          </section>

          <LoginForm />
        </div>
      </div>
    </main>
  )
}
