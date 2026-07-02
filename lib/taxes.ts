// Steuerschätzung für die Finanzen-Seite (GuV / EÜR).
//
// Vereinfachtes Modell nach deutschem Steuerrecht (Stand 2026) — als
// Orientierung gedacht, ersetzt keine Steuerberatung:
//
//   Gewerbesteuer:  Gewerbeertrag (auf volle 100 € abgerundet, abzüglich
//                   Freibetrag 24.500 € bei Einzelunternehmen/Personen-
//                   gesellschaften) × Messzahl 3,5 % × Hebesatz der Gemeinde.
//   Körperschaftsteuer: 15 % auf den Gewinn — nur Kapitalgesellschaften
//                   (GmbH, UG, AG).
//   Solidaritätszuschlag: 5,5 % auf die Körperschaftsteuer.
//
// Bei Personengesellschaften/Einzelunternehmen fällt statt KSt die
// persönliche Einkommensteuer der Inhaber an (individuell, hier nicht
// berechnet); die Gewerbesteuer wird darauf teilweise angerechnet (§ 35 EStG).

export type LegalForm = 'kapitalgesellschaft' | 'personengesellschaft'

export const LEGAL_FORM_LABELS: Record<LegalForm, string> = {
  kapitalgesellschaft: 'Kapitalgesellschaft (GmbH/UG)',
  personengesellschaft: 'Einzelunternehmen / Personengesellschaft',
}

export const GEWERBESTEUER_MESSZAHL = 0.035
export const GEWERBESTEUER_FREIBETRAG = 24_500
export const KOERPERSCHAFTSTEUER_SATZ = 0.15
export const SOLI_SATZ = 0.055
export const DEFAULT_HEBESATZ = 400

export interface TaxEstimate {
  gewinn: number
  gewerbeertrag: number
  gewerbesteuerMessbetrag: number
  gewerbesteuer: number
  koerperschaftsteuer: number
  soli: number
  steuernGesamt: number
  gewinnNachSteuern: number
}

export function estimateTaxes(
  gewinn: number,
  legalForm: LegalForm,
  hebesatzProzent: number,
): TaxEstimate {
  const freibetrag = legalForm === 'personengesellschaft' ? GEWERBESTEUER_FREIBETRAG : 0

  // Gewerbeertrag: Gewinn minus Freibetrag, auf volle 100 € abgerundet.
  const gewerbeertrag = Math.max(0, Math.floor(Math.max(0, gewinn - freibetrag) / 100) * 100)
  const gewerbesteuerMessbetrag = gewerbeertrag * GEWERBESTEUER_MESSZAHL
  const gewerbesteuer = gewerbesteuerMessbetrag * (hebesatzProzent / 100)

  const koerperschaftsteuer =
    legalForm === 'kapitalgesellschaft' && gewinn > 0 ? gewinn * KOERPERSCHAFTSTEUER_SATZ : 0
  const soli = koerperschaftsteuer * SOLI_SATZ

  const steuernGesamt = gewerbesteuer + koerperschaftsteuer + soli

  return {
    gewinn,
    gewerbeertrag,
    gewerbesteuerMessbetrag,
    gewerbesteuer,
    koerperschaftsteuer,
    soli,
    steuernGesamt,
    gewinnNachSteuern: gewinn - steuernGesamt,
  }
}

export function formatEur(value: number): string {
  return value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
