// Konfigurierbare Schichtnamen.
//
// Schichten werden je Unternehmen in settings (key 'shift_names') gepflegt.
// Ist nichts konfiguriert, gelten die drei Standard-Schichten. Die Anzeige-
// Labels kommen aus lib/labels (Frueh→Frühschicht … bzw. Fallback für eigene
// Namen). DB-seitig ist shift_assignments.shift_slot seit 0023 frei (kein CHECK).

export const DEFAULT_SHIFT_SLOTS = ['Frueh', 'Spaet', 'Nacht'] as const

/** Liefert die konfigurierten Schichtnamen (settings-Wert) oder die Defaults. */
export function resolveShiftSlots(value: unknown): string[] {
  if (Array.isArray(value)) {
    const cleaned = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (cleaned.length > 0) return cleaned
  }
  return [...DEFAULT_SHIFT_SLOTS]
}
