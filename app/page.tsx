import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">ON Mobility</p>
        <h1 className="mt-3 text-3xl font-bold">Portal ist bereit</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Next.js, TypeScript, Tailwind und Supabase sind verbunden. Als naechsten Schritt setzen wir
          Auth, Datenmodelle fuer Fahrer und Flotte sowie Realtime-Subscriptions um.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
