'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSuperadmin } from '@/lib/superadmin'
import type { CompanyRole, Database } from '@/lib/supabase/database.types'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string }

const roleSchema = z.enum(['owner', 'admin', 'member'])

function slugify(name: string, suffix: string) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'firma'}-${suffix}`
}

const DEFAULT_SETTINGS: Record<string, string[]> = {
  vehicle_statuses: ['active', 'maintenance', 'offline'],
  document_types: ['pschein', 'hu', 'versicherung'],
  document_statuses: ['valid', 'expiring', 'expired', 'pending'],
  incident_types: ['schaeden', 'bussgelder', 'sperrungen'],
  incident_severities: ['low', 'medium', 'high'],
  incident_statuses: ['open', 'in_progress', 'resolved'],
}

// =====================================================================
// COMPANIES
// =====================================================================

const companyNameSchema = z.string().trim().min(2, 'Name muss mind. 2 Zeichen haben.').max(120)

export async function createCompanyAsAdmin(name: string): Promise<ActionResult<{ id: string }>> {
  const { admin } = await requireSuperadmin()
  const parsed = companyNameSchema.safeParse(name)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }

  // Unique-ish slug without a DB round trip loop.
  const suffix = Math.abs(hashString(parsed.data + Date.now().toString())).toString(36).slice(0, 6)
  const { data: company, error } = await admin
    .from('companies')
    .insert({ name: parsed.data, slug: slugify(parsed.data, suffix) })
    .select('id')
    .single()

  if (error || !company) {
    return { success: false, error: error?.message ?? 'Unternehmen konnte nicht erstellt werden.' }
  }

  // Seed default configuration lists for the new company.
  const settingsRows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
    company_id: company.id,
    key,
    value,
  }))
  await admin.from('settings').upsert(settingsRows, { onConflict: 'company_id,key' })

  revalidatePath('/superadmin')
  return { success: true, data: { id: company.id } }
}

export async function renameCompany(id: string, name: string): Promise<ActionResult> {
  const { admin } = await requireSuperadmin()
  const idOk = z.uuid().safeParse(id)
  const nameOk = companyNameSchema.safeParse(name)
  if (!idOk.success) return { success: false, error: 'Ungültige Unternehmens-ID.' }
  if (!nameOk.success) return { success: false, error: nameOk.error.issues[0]!.message }

  const { error } = await admin.from('companies').update({ name: nameOk.data }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/superadmin')
  return { success: true }
}

// Accept a cropped data URL (image/*) or null to clear the logo. Capped at
// ~1.5MB encoded to keep the companies row reasonable.
const companyLogoSchema = z.object({
  companyId: z.uuid('Ungültige Unternehmens-ID.'),
  logoUrl: z
    .string()
    .max(1_500_000, 'Bild ist zu groß.')
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Ungültiges Bildformat.')
    .nullable(),
})

export async function setCompanyLogo(
  companyId: string,
  logoUrl: string | null,
): Promise<ActionResult> {
  const { admin } = await requireSuperadmin()
  const parsed = companyLogoSchema.safeParse({ companyId, logoUrl })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }

  const { error } = await admin
    .from('companies')
    .update({ logo_url: parsed.data.logoUrl })
    .eq('id', parsed.data.companyId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/superadmin')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const { admin } = await requireSuperadmin()
  if (!z.uuid().safeParse(id).success) return { success: false, error: 'Ungültige Unternehmens-ID.' }

  // ON DELETE CASCADE removes memberships and all business data for the company.
  const { error } = await admin.from('companies').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/superadmin')
  return { success: true }
}

// =====================================================================
// USERS
// =====================================================================

const createUserSchema = z.object({
  email: z.email('Ungültige E-Mail.'),
  password: z.string().min(8, 'Passwort muss mind. 8 Zeichen haben.'),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  isSuperadmin: z.boolean().optional(),
  companyId: z.uuid().optional().or(z.literal('')),
  role: roleSchema.optional(),
})

export async function createUser(input: {
  email: string
  password: string
  firstName?: string
  lastName?: string
  isSuperadmin?: boolean
  companyId?: string
  role?: CompanyRole
}): Promise<ActionResult<{ userId: string }>> {
  const { admin } = await requireSuperadmin()
  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }
  const v = parsed.data

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    return { success: false, error: createError?.message ?? 'Nutzer konnte nicht erstellt werden.' }
  }

  const userId = created.user.id

  // The handle_new_user trigger creates the profile row; update its fields.
  await admin
    .from('profiles')
    .update({
      first_name: v.firstName || null,
      last_name: v.lastName || null,
      is_superadmin: Boolean(v.isSuperadmin),
    })
    .eq('id', userId)

  if (v.companyId) {
    await admin
      .from('company_users')
      .upsert(
        { company_id: v.companyId, user_id: userId, role: v.role ?? 'member' },
        { onConflict: 'company_id,user_id' },
      )
  }

  revalidatePath('/superadmin')
  return { success: true, data: { userId } }
}

const updateUserSchema = z.object({
  userId: z.uuid(),
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  isSuperadmin: z.boolean().optional(),
})

export async function updateUser(input: {
  userId: string
  firstName?: string | null
  lastName?: string | null
  isSuperadmin?: boolean
}): Promise<ActionResult> {
  const { admin } = await requireSuperadmin()
  const parsed = updateUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }
  const v = parsed.data

  const patch: ProfileUpdate = {}
  if (v.firstName !== undefined) patch.first_name = v.firstName || null
  if (v.lastName !== undefined) patch.last_name = v.lastName || null
  if (v.isSuperadmin !== undefined) patch.is_superadmin = v.isSuperadmin

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('profiles').update(patch).eq('id', v.userId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/superadmin')
  return { success: true }
}

export async function assignMembership(input: {
  userId: string
  companyId: string
  role: CompanyRole
}): Promise<ActionResult> {
  const { admin } = await requireSuperadmin()
  const parsed = z
    .object({ userId: z.uuid(), companyId: z.uuid(), role: roleSchema })
    .safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }

  const { error } = await admin
    .from('company_users')
    .upsert(
      { user_id: parsed.data.userId, company_id: parsed.data.companyId, role: parsed.data.role },
      { onConflict: 'company_id,user_id' },
    )
  if (error) return { success: false, error: error.message }

  revalidatePath('/superadmin')
  return { success: true }
}

export async function removeMembership(input: {
  userId: string
  companyId: string
}): Promise<ActionResult> {
  const { admin } = await requireSuperadmin()
  const parsed = z.object({ userId: z.uuid(), companyId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'Ungültige Eingabe.' }

  const { error } = await admin
    .from('company_users')
    .delete()
    .eq('user_id', parsed.data.userId)
    .eq('company_id', parsed.data.companyId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/superadmin')
  return { success: true }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const { admin, user } = await requireSuperadmin()
  if (!z.uuid().safeParse(userId).success) return { success: false, error: 'Ungültige Nutzer-ID.' }
  if (userId === user.id) {
    return { success: false, error: 'Du kannst dich nicht selbst löschen.' }
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/superadmin')
  return { success: true }
}

// Tiny deterministic string hash for slug suffixes (no Math.random needed).
function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}
