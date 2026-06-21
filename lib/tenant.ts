import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CompanyRole } from '@/lib/supabase/database.types'

export const ACTIVE_COMPANY_COOKIE = 'active_company_id'

export type UserCompany = {
  id: string
  name: string
  slug: string
  role: CompanyRole
}

/**
 * All companies the current user belongs to, with their role in each.
 * RLS already restricts company_users / companies to the caller, so this
 * is safe to run with the normal authenticated server client.
 */
export async function getUserCompanies(): Promise<UserCompany[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Two simple queries (instead of an embedded join) keep this fully
  // type-safe against the hand-maintained Database types and avoid
  // PostgREST relationship inference.
  //
  // We filter by user_id explicitly: the company_users RLS policy lets a
  // member see ALL memberships of their companies (i.e. their colleagues),
  // so without this filter a multi-member company would appear multiple
  // times — once per member.
  const { data: memberships, error: membershipError } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (membershipError || !memberships || memberships.length === 0) return []

  const ids = memberships.map((m) => m.company_id)
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, slug')
    .in('id', ids)

  const byId = new Map((companies ?? []).map((c) => [c.id, c]))

  return memberships
    .map((m) => {
      const company = byId.get(m.company_id)
      if (!company) return null
      return { id: company.id, name: company.name, slug: company.slug, role: m.role }
    })
    .filter((c): c is UserCompany => c !== null)
}

/**
 * Resolves the company the user is currently acting in:
 *   1. the cookie value, if the user still belongs to that company
 *   2. otherwise the first company they belong to
 *   3. null if they belong to none (→ onboarding)
 */
export async function resolveActiveCompany(
  companies?: UserCompany[],
): Promise<UserCompany | null> {
  const list = companies ?? (await getUserCompanies())
  if (list.length === 0) return null

  const cookieStore = await cookies()
  const preferredId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value

  return list.find((c) => c.id === preferredId) ?? list[0]
}

/**
 * Page-level guard: returns the active company or redirects to onboarding
 * if the user belongs to none. Use in server components that load
 * tenant-scoped data so initial render matches the client's active tenant.
 */
export async function requireActiveCompany(): Promise<UserCompany> {
  const active = await resolveActiveCompany()
  if (!active) redirect('/no-company')
  return active
}
