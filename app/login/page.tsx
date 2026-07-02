import { redirectIfAuthenticated } from '@/lib/auth'
import { LoginForm } from '@/components/auth/login-form'
import { CompanyLogo } from '@/components/branding/company-logo'
import { CalendarDays, Car, ShieldCheck, Users } from 'lucide-react'

const FEATURES = [
  { icon: Users, label: 'Fahrerverwaltung', text: 'Stammdaten, P-Schein-Fristen und Notizen an einem Ort.' },
  { icon: Car, label: 'Flotte im Blick', text: 'Fahrzeugstatus, Wartung und Kosten pro Fahrzeug.' },
  { icon: CalendarDays, label: 'Disposition', text: 'Schichten planen, Konflikte werden automatisch erkannt.' },
  { icon: ShieldCheck, label: 'Compliance', text: 'Dokumente und Ablaufdaten mit Erinnerungen.' },
]

export default async function LoginPage() {
  await redirectIfAuthenticated()

  return (
    // Login bleibt bewusst hell (weiß/grau) — unabhängig vom Portal-Theme.
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="animate-fade-up w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)]">
        <div className="grid lg:grid-cols-[1.15fr_1fr]">
          {/* Marken-/Info-Spalte */}
          <section className="relative border-b border-slate-200 bg-slate-50/80 p-8 sm:p-10 lg:border-b-0 lg:border-r">
            {/* Dezente Akzentkante oben */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />

            <CompanyLogo size="lg" className="mb-8" />

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Willkommen zurück
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-600 sm:text-base">
              Das Portal für Fahrer, Fahrzeuge, Schichten und Compliance — alles in einer Oberfläche.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, label, text }) => (
                <li key={label} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs leading-relaxed text-slate-500">{text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-10 text-xs text-slate-400">TAS FLEET v0.9.11 · TAS WEBWORKS</p>
          </section>

          {/* Formular-Spalte */}
          <section className="flex items-center justify-center p-6 sm:p-10">
            <LoginForm />
          </section>
        </div>
      </div>
    </main>
  )
}
