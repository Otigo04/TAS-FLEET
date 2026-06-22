// Zentrale Anzeige-/Übersetzungsschicht für interne Status- und Werte-Codes.
//
// Warum: Die Datenbank speichert weiterhin stabile, technische Codes
// (z. B. 'active', 'resolved', 'pschein'). Daran hängen CHECK-Constraints,
// Realtime-Filter und Badge-Varianten – die dürfen sich NICHT ändern.
// Hier wird ausschließlich das angezeigte Label übersetzt, damit das UI
// durchgängig professionelles Deutsch zeigt ("Gelöst" statt "resolved").
//
// Eigene, vom Nutzer in den Einstellungen angelegte Werte haben keinen
// Eintrag und fallen automatisch auf eine aufgehübschte Schreibweise zurück.

export const VALUE_LABELS: Record<string, string> = {
  // ── Fahrzeug-Status ──
  active: 'Aktiv',
  maintenance: 'In Wartung',
  offline: 'Außer Betrieb',

  // ── Dokumententypen ──
  pschein: 'P-Schein',
  hu: 'Hauptuntersuchung (HU)',
  versicherung: 'Versicherung',

  // ── Dokumenten-Status ──
  valid: 'Gültig',
  expiring: 'Läuft bald ab',
  expired: 'Abgelaufen',
  pending: 'Ausstehend',

  // ── Vorfalltypen ──
  schaeden: 'Schäden',
  bussgelder: 'Bußgelder',
  sperrungen: 'Sperrungen',

  // ── Vorfall-Prioritäten ──
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',

  // ── Vorfall-Status ──
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  resolved: 'Gelöst',
  closed: 'Geschlossen',

  // ── Schichten ──
  Frueh: 'Frühschicht',
  Spaet: 'Spätschicht',
  Nacht: 'Nachtschicht',

  // ── Abwesenheitstypen ──
  urlaub: 'Urlaub',
  krankheit: 'Krankheit',
  sonstiges: 'Sonstiges',
}

/** Vollständige Klartext-Bezeichnungen für ausgewählte Codes (z. B. Tooltips, Beschreibungen). */
export const VALUE_LABELS_LONG: Record<string, string> = {
  pschein: 'Personenbeförderungsschein',
  hu: 'Hauptuntersuchung',
}

/** Tabellennamen → fachliche Bezeichnung (Audit-Log). */
export const TABLE_LABELS: Record<string, string> = {
  drivers: 'Fahrer',
  vehicles: 'Fahrzeug',
  compliance_documents: 'Compliance-Dokument',
  incidents: 'Vorfall',
  shift_assignments: 'Schichtzuweisung',
  absences: 'Abwesenheit',
}

/** Spaltennamen → deutsche Feldbezeichnung (Audit-Log Diff). */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  first_name: 'Vorname',
  last_name: 'Nachname',
  street: 'Straße',
  street_number: 'Hausnummer',
  postal_code: 'PLZ',
  city: 'Ort',
  birth_date: 'Geburtsdatum',
  nationality: 'Staatsangehörigkeit',
  marital_status: 'Familienstand',
  tax_class: 'Steuerklasse',
  tax_id: 'Steuer-ID',
  social_security_number: 'Sozialversicherungsnr.',
  health_insurance: 'Krankenkasse',
  employment_start_date: 'Eintritt am',
  employed_as: 'Beschäftigt als',
  bank_name: 'Bank',
  iban: 'IBAN',
  pschein_valid_until: 'P-Schein gültig bis',
  district: 'Bezirk',
  current_shift: 'Schicht',
  notes: 'Notizen',
  avatar_url: 'Bild',
  license_plate: 'Kennzeichen',
  model: 'Modell',
  status: 'Status',
  doc_type: 'Dokumenttyp',
  due_date: 'Fällig am',
  scope_type: 'Bereich',
  incident_type: 'Typ',
  severity: 'Priorität',
  occurred_on: 'Datum',
  cost_eur: 'Kosten (EUR)',
  description: 'Beschreibung',
  shift_date: 'Schichtdatum',
  shift_slot: 'Schicht',
  uber_zone: 'Zone',
  driver_id: 'Fahrer',
  vehicle_id: 'Fahrzeug',
  type: 'Art',
  start_date: 'Von',
  end_date: 'Bis',
  reason: 'Grund',
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  insert: 'Erstellt',
  update: 'Geändert',
  delete: 'Gelöscht',
}

export function tableLabel(name: string): string {
  return TABLE_LABELS[name] ?? prettifyFallback(name)
}

export function fieldLabel(name: string): string {
  return FIELD_LABELS[name] ?? prettifyFallback(name)
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? prettifyFallback(action)
}

/** Macht aus einem unbekannten Code ("in_bearbeitung", "ausser-dienst") eine lesbare Form. */
function prettifyFallback(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{L}/u, (c) => c.toUpperCase())
}

/** Liefert das deutsche Anzeige-Label für einen internen Code (mit Fallback). */
export function labelFor(value: string | null | undefined): string {
  if (!value) return '–'
  return VALUE_LABELS[value] ?? prettifyFallback(value)
}

/** Wie labelFor, bevorzugt aber die ausgeschriebene Langform, falls vorhanden. */
export function longLabelFor(value: string | null | undefined): string {
  if (!value) return '–'
  return VALUE_LABELS_LONG[value] ?? labelFor(value)
}
