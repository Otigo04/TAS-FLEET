import { redirectIfAuthenticated } from '@/lib/auth'
import { LoginForm } from '@/components/auth/login-form'
import { CompanyLogo } from '@/components/branding/company-logo'

export default async function LoginPage() {
  await redirectIfAuthenticated()

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="animate-fade-up w-full max-w-5xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <section>
            <CompanyLogo className="mb-6" />
            <h1 className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">Anmeldung</h1>
            <p className="mt-4 max-w-xl text-slate-600">Verwalte Fahrer, Fahrzeuge und Schichten an einem Ort.</p>
            <p className="mt-8 text-xs text-slate-400">
              TAS FLEET · TAS WEBWORKS
            </p>
          </section>

          <LoginForm />
        </div>
      </div>
    </main>
  )
}
