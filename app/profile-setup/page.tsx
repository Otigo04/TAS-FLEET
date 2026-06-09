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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="animate-fade-up w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <section>
            <CompanyLogo className="mb-6" />
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Profil einrichten</h1>
            <p className="mt-4 max-w-xl text-slate-600">Bitte trage deinen Vor- und Nachnamen ein.</p>
            <p className="mt-8 text-xs uppercase tracking-[0.18em] text-slate-500">Angemeldet mit {user.email}</p>
          </section>

          <ProfileSetupForm initialFirstName={profile?.first_name ?? ''} initialLastName={profile?.last_name ?? ''} />
        </div>
      </div>
    </main>
  )
}
