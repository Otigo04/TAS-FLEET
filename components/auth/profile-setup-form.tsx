'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileSetupFormProps {
  initialFirstName?: string
  initialLastName?: string
}

export function ProfileSetupForm({ initialFirstName = '', initialLastName = '' }: ProfileSetupFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      setError('Bitte Vorname und Nachname eintragen.')
      setIsLoading(false)
      return
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('Sitzung konnte nicht geladen werden. Bitte erneut anmelden.')
      setIsLoading(false)
      return
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
      },
      { onConflict: 'id' }
    )

    if (upsertError) {
      setError(upsertError.message)
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Profil vervollständigen</h2>
        <p className="mt-1 text-sm text-slate-500">Vor- und Nachname eintragen.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="text-slate-700">Vorname</Label>
          <Input
            id="firstName"
            type="text"
            placeholder="Max"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-11 border-slate-300 bg-white text-slate-900 focus-visible:ring-brand-500/40"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-slate-700">Nachname</Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Mustermann"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-11 border-slate-300 bg-white text-slate-900 focus-visible:ring-brand-500/40"
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}

        <Button type="submit" className="h-11 w-full text-[15px]" disabled={isLoading}>
          {isLoading ? 'Wird gespeichert…' : 'Speichern und weiter'}
        </Button>
      </form>
    </div>
  )
}
