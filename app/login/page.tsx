import { redirectIfAuthenticated } from '@/lib/auth'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage() {
  await redirectIfAuthenticated()

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-teal-50 p-6">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">ON Mobility Portal</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Flotte und Fahrer zentral steuern</h1>
            <p className="mt-4 max-w-xl text-slate-600">
              Dokumentation, Verwaltung und Realtime-Kollaboration in einem sauberen Portal fuer den
              Betriebsalltag.
            </p>
          </section>

          <LoginForm />
        </div>
      </div>
    </main>
  )
}
