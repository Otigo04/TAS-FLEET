// Rollen- und Rechte-Schicht (RBAC).
//
// Wie bei den Status-Labels speichert die DB stabile Enum-Codes
// (company_users.role: 'owner' | 'admin' | 'member'). Daran hängen die
// RLS-Policies – die Codes bleiben. Hier liegt nur die fachliche
// Übersetzung in die deutschen Rollennamen plus das Berechtigungsmodell.
//
// Mapping:
//   owner   → Geschäftsführer   (Vollzugriff inkl. Mitgliederverwaltung)
//   admin   → Betriebsleiter    (operativer Vollzugriff, keine Mitglieder)
//   member  → Disponent         (Disposition, Vorfälle, Abwesenheiten)
// Superadmin ist plattformweit (profiles.is_superadmin) und impliziert alles.

import type { CompanyRole } from '@/lib/supabase/database.types'

export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: 'Geschäftsführer',
  admin: 'Betriebsleiter',
  member: 'Disponent',
}

export const ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  owner: 'Vollzugriff inkl. Mitglieder- und Rollenverwaltung',
  admin: 'Operativer Vollzugriff auf Stammdaten, Berichte und Einstellungen',
  member: 'Disposition, Vorfälle und Abwesenheiten – Stammdaten nur lesen',
}

/** Reihenfolge von oben (mächtigste) nach unten – z. B. für Auswahllisten. */
export const COMPANY_ROLES: CompanyRole[] = ['owner', 'admin', 'member']

export function roleLabel(role: CompanyRole | null | undefined): string {
  if (!role) return '–'
  return ROLE_LABELS[role] ?? role
}

// ── Berechtigungen ────────────────────────────────────────────────────
export type Capability =
  | 'manageMasterData' // Fahrer / Fahrzeuge / Compliance-Dokumente anlegen, ändern, löschen
  | 'manageDispatch' // Schichten / Disposition
  | 'manageIncidents' // Vorfälle erfassen & bearbeiten
  | 'manageAbsences' // Abwesenheiten verwalten
  | 'manageSettings' // Werte & Status (Einstellungen)
  | 'viewReports' // Reporting / PDF-Monatsbericht
  | 'manageMembers' // Mitglieder & Rollen verwalten
  | 'viewAudit' // Audit-Log / Änderungshistorie einsehen

const MATRIX: Record<CompanyRole, Capability[]> = {
  owner: [
    'manageMasterData',
    'manageDispatch',
    'manageIncidents',
    'manageAbsences',
    'manageSettings',
    'viewReports',
    'manageMembers',
    'viewAudit',
  ],
  admin: [
    'manageMasterData',
    'manageDispatch',
    'manageIncidents',
    'manageAbsences',
    'manageSettings',
    'viewReports',
    'viewAudit',
  ],
  member: ['manageDispatch', 'manageIncidents', 'manageAbsences'],
}

/**
 * Prüft, ob eine Rolle (optional mit Superadmin-Override) eine Berechtigung hat.
 * Superadmins dürfen plattformweit alles.
 */
export function can(
  role: CompanyRole | null | undefined,
  capability: Capability,
  isSuperadmin = false,
): boolean {
  if (isSuperadmin) return true
  if (!role) return false
  return MATRIX[role]?.includes(capability) ?? false
}
