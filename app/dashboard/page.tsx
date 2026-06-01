import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-3 text-slate-600">
          Verbunden mit Supabase. Aktueller Benutzer:{' '}
          <span className="font-semibold text-slate-900">{user?.email ?? 'nicht eingeloggt'}</span>
        </p>
      </div>
    </main>
  )
}
