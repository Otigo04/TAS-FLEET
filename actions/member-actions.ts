'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { getUserCompanies } from '@/lib/tenant'
import { getAdminClient, getCurrentSuperadmin } from '@/lib/superadmin'
import type { CompanyRole } from '@/lib/supabase/database.types'

// =====================================================================
// member-actions — Mitgliederverwaltung für den Geschäftsführer (owner).
//
// Anders als die Superadmin-Konsole (plattformweit) laufen diese Aktionen
// im Kontext EINER Firma: Der eingeloggte Geschäftsführer verwaltet nur die
// Mitglieder seines eigenen Unternehmens. Für das Anlegen/Löschen von
// Auth-Nutzern brauchen wir den Service-Role-Client (umgeht RLS) — deshalb
// wird bei JEDER Aktion serverseitig geprüft, dass der Aufrufer wirklich
// Geschäftsführer (owner) genau dieser Firma ist (Superadmin zählt auch).
//
// Rollen, die ein Geschäftsführer vergeben/ändern darf: nur 'admin'
// (Betriebsleiter) und 'member' (Disponent). Die owner-Rolle bleibt der
// Superadmin-Konsole vorbehalten und kann hier weder gesetzt noch geändert
// noch gelöscht werden.
// =====================================================================

type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string }

/** Rollen, die der Geschäftsführer selbst vergeben darf. */
const assignableRoleSchema = z.enum(['admin', 'member'])

export type CompanyMember = {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: CompanyRole
  /** Der aktuell eingeloggte Geschäftsführer selbst (nicht editier-/löschbar). */
  isSelf: boolean
  /** Nutzer gehört nur zu dieser Firma → „Löschen“ entfernt den Account ganz. */
  onlyThisCompany: boolean
  /** Plattform-Superadmin → vom Geschäftsführer nicht veränderbar. */
  isSuperadmin: boolean
}

// ---------------------------------------------------------------------
// Guard: Aufrufer muss Geschäftsführer (owner) der Firma sein
// (oder Superadmin). Liefert die User-ID zurück oder eine Fehlermeldung.
// ---------------------------------------------------------------------
async function requireOwnerOf(
  companyId: string,
): Promise<{ userId: string } | { error: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Nicht authentifiziert.' }

  const { isSuperadmin } = await getCurrentSuperadmin()
  if (isSuperadmin) return { userId: user.id }

  const companies = await getUserCompanies()
  const membership = companies.find((c) => c.id === companyId)
  if (!membership || membership.role !== 'owner') {
    return { error: 'Nur der Geschäftsführer darf Mitglieder verwalten.' }
  }
  return { userId: user.id }
}

// ---------------------------------------------------------------------
// listCompanyMembers — alle Mitglieder der Firma (für die Übersicht).
// Wird serverseitig aus der Einstellungen-Seite aufgerufen.
// ---------------------------------------------------------------------
export async function listCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  if (!z.uuid().safeParse(companyId).success) return []
  const guard = await requireOwnerOf(companyId)
  if ('error' in guard) return []

  const admin = getAdminClient()

  // Mitgliedschaften dieser Firma + ALLE Mitgliedschaften (für die Prüfung,
  // ob ein Nutzer nur zu dieser einen Firma gehört).
  const [{ data: companyMembers }, { data: allMemberships }, { data: profiles }, { data: authData }] =
    await Promise.all([
      admin.from('company_users').select('user_id, role').eq('company_id', companyId),
      admin.from('company_users').select('user_id'),
      admin.from('profiles').select('id, first_name, last_name, is_superadmin'),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

  const membershipCount = new Map<string, number>()
  for (const m of allMemberships ?? []) {
    membershipCount.set(m.user_id, (membershipCount.get(m.user_id) ?? 0) + 1)
  }
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? '—']))

  const roleRank: Record<CompanyRole, number> = { owner: 0, admin: 1, member: 2 }

  return (companyMembers ?? [])
    .map((m) => {
      const profile = profileById.get(m.user_id)
      return {
        userId: m.user_id,
        email: emailById.get(m.user_id) ?? '—',
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        role: m.role,
        isSelf: m.user_id === guard.userId,
        onlyThisCompany: (membershipCount.get(m.user_id) ?? 1) <= 1,
        isSuperadmin: Boolean(profile?.is_superadmin),
      }
    })
    .sort((a, b) => roleRank[a.role] - roleRank[b.role] || a.email.localeCompare(b.email))
}

// ---------------------------------------------------------------------
// createCompanyMember — legt einen neuen Nutzer an und verknüpft ihn als
// Mitglied der Firma. Existiert die E-Mail bereits, wird der bestehende
// Account nur der Firma zugeordnet (idempotent).
// ---------------------------------------------------------------------
const createMemberSchema = z.object({
  companyId: z.uuid(),
  email: z.email('Ungültige E-Mail.'),
  password: z.string().min(8, 'Passwort muss mind. 8 Zeichen haben.'),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  role: assignableRoleSchema,
})

export async function createCompanyMember(input: {
  companyId: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  role: CompanyRole
}): Promise<ActionResult<{ userId: string }>> {
  const parsed = createMemberSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }
  const v = parsed.data

  const guard = await requireOwnerOf(v.companyId)
  if ('error' in guard) return { success: false, error: guard.error }

  const admin = getAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
  })

  let userId: string
  if (createError || !created?.user) {
    // Fällt der Nutzer schon existiert-Fehler zurück: bestehenden Account suchen
    // und nur die Mitgliedschaft anhängen.
    const alreadyExists = /already.*(registered|exists)/i.test(createError?.message ?? '')
    if (!alreadyExists) {
      return { success: false, error: createError?.message ?? 'Nutzer konnte nicht erstellt werden.' }
    }
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users.find(
      (u) => u.email?.toLowerCase() === v.email.toLowerCase(),
    )
    if (!existing) {
      return { success: false, error: 'E-Mail bereits vergeben, Nutzer aber nicht auffindbar.' }
    }
    userId = existing.id
  } else {
    userId = created.user.id
    // Der handle_new_user-Trigger legt das Profil an; Namen nachtragen.
    await admin
      .from('profiles')
      .update({ first_name: v.firstName || null, last_name: v.lastName || null })
      .eq('id', userId)
  }

  const { error: membershipError } = await admin
    .from('company_users')
    .upsert(
      { company_id: v.companyId, user_id: userId, role: v.role },
      { onConflict: 'company_id,user_id' },
    )
  if (membershipError) return { success: false, error: membershipError.message }

  revalidatePath('/einstellungen')
  return { success: true, data: { userId } }
}

// ---------------------------------------------------------------------
// changeMemberRole — Rolle eines Mitglieds ändern. Nur zwischen
// Betriebsleiter (admin) und Disponent (member); owner ist tabu.
// ---------------------------------------------------------------------
const changeRoleSchema = z.object({
  companyId: z.uuid(),
  userId: z.uuid(),
  role: assignableRoleSchema,
})

export async function changeMemberRole(input: {
  companyId: string
  userId: string
  role: CompanyRole
}): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]!.message }
  const v = parsed.data

  const guard = await requireOwnerOf(v.companyId)
  if ('error' in guard) return { success: false, error: guard.error }
  if (v.userId === guard.userId) {
    return { success: false, error: 'Du kannst deine eigene Rolle nicht ändern.' }
  }

  const admin = getAdminClient()

  // Aktuelle Rolle prüfen: ein owner darf nicht herabgestuft werden.
  const { data: current } = await admin
    .from('company_users')
    .select('role')
    .eq('company_id', v.companyId)
    .eq('user_id', v.userId)
    .maybeSingle()

  if (!current) return { success: false, error: 'Mitglied gehört nicht zu diesem Unternehmen.' }
  if (current.role === 'owner') {
    return { success: false, error: 'Die Rolle des Geschäftsführers kann hier nicht geändert werden.' }
  }

  const { error } = await admin
    .from('company_users')
    .update({ role: v.role })
    .eq('company_id', v.companyId)
    .eq('user_id', v.userId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/einstellungen')
  return { success: true }
}

// ---------------------------------------------------------------------
// removeCompanyMember — Mitglied aus der Firma entfernen. Gehört der Nutzer
// nur zu dieser Firma (und ist kein Superadmin), wird der Account komplett
// gelöscht; sonst wird nur die Mitgliedschaft aufgehoben (Multi-Tenant-Schutz).
// ---------------------------------------------------------------------
const removeMemberSchema = z.object({ companyId: z.uuid(), userId: z.uuid() })

export async function removeCompanyMember(input: {
  companyId: string
  userId: string
}): Promise<ActionResult<{ deletedAccount: boolean }>> {
  const parsed = removeMemberSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Ungültige Eingabe.' }
  const v = parsed.data

  const guard = await requireOwnerOf(v.companyId)
  if ('error' in guard) return { success: false, error: guard.error }
  if (v.userId === guard.userId) {
    return { success: false, error: 'Du kannst dich nicht selbst entfernen.' }
  }

  const admin = getAdminClient()

  const { data: target } = await admin
    .from('company_users')
    .select('role')
    .eq('company_id', v.companyId)
    .eq('user_id', v.userId)
    .maybeSingle()

  if (!target) return { success: false, error: 'Mitglied gehört nicht zu diesem Unternehmen.' }
  if (target.role === 'owner') {
    return { success: false, error: 'Ein Geschäftsführer kann hier nicht entfernt werden.' }
  }

  // Gehört der Nutzer noch zu weiteren Firmen oder ist er Superadmin?
  const [{ data: otherMemberships }, { data: profile }] = await Promise.all([
    admin.from('company_users').select('company_id').eq('user_id', v.userId),
    admin.from('profiles').select('is_superadmin').eq('id', v.userId).maybeSingle(),
  ])

  const belongsElsewhere = (otherMemberships ?? []).some((m) => m.company_id !== v.companyId)
  const isSuperadmin = Boolean(profile?.is_superadmin)

  if (!belongsElsewhere && !isSuperadmin) {
    // Account gehört nur zu dieser Firma → vollständig löschen.
    const { error } = await admin.auth.admin.deleteUser(v.userId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/einstellungen')
    return { success: true, data: { deletedAccount: true } }
  }

  // Sonst nur die Mitgliedschaft entfernen.
  const { error } = await admin
    .from('company_users')
    .delete()
    .eq('company_id', v.companyId)
    .eq('user_id', v.userId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/einstellungen')
  return { success: true, data: { deletedAccount: false } }
}
