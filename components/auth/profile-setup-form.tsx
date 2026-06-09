'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <Card className="surface-card w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Profil vervollstaendigen</CardTitle>
        <CardDescription>Vor- und Nachname eintragen</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Vorname</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="Max"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Nachname</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Mustermann"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Wird gespeichert...' : 'Speichern und weiter'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
