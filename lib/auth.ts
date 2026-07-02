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

/**
 * Das Profil des eingeloggten Nutzers, per React cache() über den Request
 * dedupliziert — Layout und Page teilen sich EINE Profil-Query.
 */
const getOwnProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, role, created_at')
    .eq('id', userId)
    .maybeSingle()
  return profile
})

export async function requireUser() {
  const supabase = await createClient()
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getOwnProfile(user.id)

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
  const user = await getAuthUser()

  if (user) {
    const profile = await getOwnProfile(user.id)
    redirect(isProfileComplete(profile) ? '/dashboard' : '/profile-setup')
  }
}
