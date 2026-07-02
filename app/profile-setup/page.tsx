import { redirect } from 'next/navigation'
import { CompanyLogo } from '@/components/branding/company-logo'
import { ProfileSetupForm } from '@/components/auth/profile-setup-form'
import { isProfileComplete, requireUser } from '@/lib/auth'

export default async function ProfileSetupPage() {
  const { user, profile } = await requireUser()

  if (isProfileComplete(profile)) {
    redirect('/dashboard')
  }

  return (
    // Bleibt wie der Login bewusst hell (weiß/grau).
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="animate-fade-up w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)]">
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <section className="relative border-b border-slate-200 bg-slate-50/80 p-8 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />
            <CompanyLogo size="lg" className="mb-8" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Profil einrichten</h1>
            <p className="mt-2 max-w-md text-sm text-slate-600 sm:text-base">
              Nur noch ein Schritt: Trage deinen Vor- und Nachnamen ein, damit dein Team dich erkennt.
            </p>
            <p className="mt-8 text-xs text-slate-400">Angemeldet mit {user.email}</p>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <ProfileSetupForm initialFirstName={profile?.first_name ?? ''} initialLastName={profile?.last_name ?? ''} />
          </section>
        </div>
      </div>
    </main>
  )
}
