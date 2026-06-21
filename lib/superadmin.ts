import { redirect } from 'next/navigation'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database, CompanyRole } from '@/lib/supabase/database.types'

/**
 * Service-role client. Bypasses RLS and can reach the Auth Admin API.
 * SERVER ONLY — never import into a Client Component.
 */
export function getAdminClient(): SupabaseClient<Database> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert (.env.local).')
  }
  return createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Superadmin status of the current user — tolerant if the column is absent. */
export async function getCurrentSuperadmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, isSuperadmin: false }

  const { data } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle()

  return { user, isSuperadmin: Boolean(data?.is_superadmin) }
}

/** Page/action guard: must be a superadmin, else redirect away. */
export async function requireSuperadmin() {
  const { user, isSuperadmin } = await getCurrentSuperadmin()
  if (!user) redirect('/login')
  if (!isSuperadmin) redirect('/dashboard')
  return { user, admin: getAdminClient() }
}

// ---------------------------------------------------------------------
// Read models for the console.
// ---------------------------------------------------------------------

export type AdminCompany = {
  id: string
  name: string
  slug: string
  createdAt: string
  memberCount: number
}

export type AdminUserMembership = {
  companyId: string
  companyName: string
  role: CompanyRole
}

export type AdminUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  isSuperadmin: boolean
  createdAt: string
  memberships: AdminUserMembership[]
}

export async function listCompanies(): Promise<AdminCompany[]> {
  const admin = getAdminClient()
  const [{ data: companies }, { data: members }] = await Promise.all([
    admin.from('companies').select('*').order('created_at', { ascending: true }),
    admin.from('company_users').select('company_id'),
  ])

  const counts = new Map<string, number>()
  for (const m of members ?? []) {
    counts.set(m.company_id, (counts.get(m.company_id) ?? 0) + 1)
  }

  return (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    createdAt: c.created_at,
    memberCount: counts.get(c.id) ?? 0,
  }))
}

export async function listUsers(): Promise<AdminUser[]> {
  const admin = getAdminClient()

  const [{ data: authData }, { data: profiles }, { data: memberships }, { data: companies }] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from('profiles').select('id, first_name, last_name, is_superadmin'),
      admin.from('company_users').select('company_id, user_id, role'),
      admin.from('companies').select('id, name'),
    ])

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]))

  const membershipsByUser = new Map<string, AdminUserMembership[]>()
  for (const m of memberships ?? []) {
    const list = membershipsByUser.get(m.user_id) ?? []
    list.push({
      companyId: m.company_id,
      companyName: companyName.get(m.company_id) ?? '—',
      role: m.role,
    })
    membershipsByUser.set(m.user_id, list)
  }

  return (authData?.users ?? []).map((u) => {
    const profile = profileById.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '—',
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      isSuperadmin: Boolean(profile?.is_superadmin),
      createdAt: u.created_at,
      memberships: membershipsByUser.get(u.id) ?? [],
    }
  })
}
