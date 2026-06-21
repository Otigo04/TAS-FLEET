'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, ACTIVE_COMPANY_COOKIE } from '@/lib/tenant'
import type { CompanyRole } from '@/lib/supabase/database.types'

type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string }

const ACTIVE_COMPANY_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
}

/**
 * Service-role client. NEVER import this into a Client Component — it
 * bypasses RLS entirely and must stay on the server. Used only for the
 * privileged Auth Admin invite flow.
 */
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert (in .env.local hinterlegen).',
    )
  }
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------
// createCompany — creates a company and makes the caller its owner.
// ---------------------------------------------------------------------

const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'Unternehmensname muss mindestens 2 Zeichen haben.').max(120),
})

export async function createCompany(
  name: string,
): Promise<ActionResult<{ id: string; slug: string; name: string }>> {
  const parsed = createCompanySchema.safeParse({ name })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nicht authentifiziert.' }

  // The SECURITY DEFINER RPC creates the company, links the caller as
  // 'owner', and seeds default settings — all in one transaction.
  const { data, error } = await supabase.rpc('create_company_with_owner', {
    company_name: parsed.data.name,
  })

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Unternehmen konnte nicht erstellt werden.' }
  }

  // Make the freshly created company the active one.
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_COMPANY_COOKIE, data.id, ACTIVE_COMPANY_COOKIE_OPTIONS)

  revalidatePath('/', 'layout')
  return { success: true, data: { id: data.id, slug: data.slug, name: data.name } }
}

// ---------------------------------------------------------------------
// inviteUserToCompany — invites a user by email and links them to the
// company. Requires the caller to be owner/admin of that company.
// ---------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.email('Ungültige E-Mail-Adresse.'),
  companyId: z.uuid('Ungültige Unternehmens-ID.'),
  role: z.enum(['owner', 'admin', 'member']),
})

export async function inviteUserToCompany(
  email: string,
  companyId: string,
  role: CompanyRole,
): Promise<ActionResult<{ userId: string }>> {
  const parsed = inviteSchema.safeParse({ email, companyId, role })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  // Authorisation: only owners/admins of the target company may invite.
  const companies = await getUserCompanies()
  const caller = companies.find((c) => c.id === parsed.data.companyId)
  if (!caller || (caller.role !== 'owner' && caller.role !== 'admin')) {
    return { success: false, error: 'Keine Berechtigung, Nutzer in dieses Unternehmen einzuladen.' }
  }

  let admin
  try {
    admin = getAdminClient()
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Admin-Client Fehler.' }
  }

  // Invite the user via Supabase Auth Admin. If they already exist, fall
  // back to looking up their id so we can still attach the membership.
  let userId: string | null = null
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
  )

  if (inviteError) {
    const alreadyExists = /already.*(registered|exists)/i.test(inviteError.message)
    if (!alreadyExists) {
      return { success: false, error: inviteError.message }
    }
    // Look up the existing user by email (paginated admin listing).
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    userId = list?.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase())?.id ?? null
    if (!userId) {
      return { success: false, error: 'Nutzer existiert bereits, konnte aber nicht gefunden werden.' }
    }
  } else {
    userId = invited.user?.id ?? null
  }

  if (!userId) {
    return { success: false, error: 'Nutzer-ID konnte nicht ermittelt werden.' }
  }

  // Attach the membership (service role bypasses RLS; idempotent).
  const { error: membershipError } = await admin
    .from('company_users')
    .upsert(
      { company_id: parsed.data.companyId, user_id: userId, role: parsed.data.role },
      { onConflict: 'company_id,user_id' },
    )

  if (membershipError) {
    return { success: false, error: membershipError.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data: { userId } }
}

// ---------------------------------------------------------------------
// setActiveCompany — switches the active tenant (validated membership).
// ---------------------------------------------------------------------

export async function setActiveCompany(companyId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(companyId)
  if (!parsed.success) return { success: false, error: 'Ungültige Unternehmens-ID.' }

  const companies = await getUserCompanies()
  if (!companies.some((c) => c.id === companyId)) {
    return { success: false, error: 'Du gehörst diesem Unternehmen nicht an.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, ACTIVE_COMPANY_COOKIE_OPTIONS)

  revalidatePath('/', 'layout')
  return { success: true }
}
