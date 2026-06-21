import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: 'admin'
  created_at: string
}

export function isProfileComplete(profile: Profile | null) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim())
}

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, role, created_at')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, user, profile }
}

export async function requireCompletedUser() {
  const context = await requireUser()

  if (!isProfileComplete(context.profile)) {
    redirect('/profile-setup')
  }

  return context
}

export async function redirectIfAuthenticated() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, role, created_at')
      .eq('id', user.id)
      .maybeSingle()

    redirect(isProfileComplete(profile) ? '/dashboard' : '/profile-setup')
  }
}
