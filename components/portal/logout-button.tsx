'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const supabase = createClient()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const showLoadingSpinner = useDelayedLoading(isLoading)

  async function handleLogout() {
    setIsLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoading}>
      {showLoadingSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {isLoading ? 'Logout...' : 'Logout'}
    </Button>
  )
}
