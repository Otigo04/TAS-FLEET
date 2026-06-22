import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * The authenticated user, validated against Supabase Auth.
 *
 * `auth.getUser()` is a network round-trip on every call. Wrapping it in
 * React `cache()` dedupes it for the duration of a single server request, so
 * the layout, the page and every tenant/superadmin helper that needs the user
 * share ONE round-trip instead of issuing two or three. Returns `null` when
 * unauthenticated — callers decide whether to redirect.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

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
  const user = await getAuthUser()

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
