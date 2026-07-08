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

// =====================================================================
// Umsatzsteuer (USt) / Vorsteuer / Zahllast
//
// amount_eur einer Buchung ist BRUTTO. Aus dem USt-Satz je Buchung wird
// Netto und USt-Anteil abgeleitet. Einnahmen liefern vereinnahmte USt
// (Ausgangssteuer), Ausgaben liefern abziehbare Vorsteuer. Die Zahllast
// ans Finanzamt ist USt − Vorsteuer (negativ = Vorsteuer-Überhang/Erstattung).
// =====================================================================

/** Übliche deutsche USt-Sätze (Regelsatz, ermäßigt, steuerfrei/0). */
export const VAT_RATES = [19, 7, 0] as const

/** Nettobetrag aus Brutto und USt-Satz (Prozent). */
export function netFromGross(gross: number, vatRatePercent: number): number {
  return gross / (1 + vatRatePercent / 100)
}

/** USt-Anteil aus Brutto und USt-Satz (Prozent). */
export function vatFromGross(gross: number, vatRatePercent: number): number {
  return gross - netFromGross(gross, vatRatePercent)
}

export interface VatSummary {
  einnahmenBrutto: number
  einnahmenNetto: number
  ausgabenBrutto: number
  ausgabenNetto: number
  umsatzsteuer: number // vereinnahmt aus Einnahmen (Ausgangssteuer)
  vorsteuer: number    // abziehbar aus Ausgaben
  zahllast: number     // Umsatzsteuer − Vorsteuer (>0 = an FA zahlen)
}

/**
 * Aggregiert USt/Vorsteuer/Zahllast über eine Menge Buchungen.
 * Jede Buchung: kind ('einnahme' | 'ausgabe'), amount_eur (brutto), vat_rate (%).
 */
export function summarizeVat(
  entries: { kind: 'einnahme' | 'ausgabe'; amount_eur: number; vat_rate: number }[],
): VatSummary {
  let einnahmenBrutto = 0, einnahmenNetto = 0, umsatzsteuer = 0
  let ausgabenBrutto = 0, ausgabenNetto = 0, vorsteuer = 0
  for (const e of entries) {
    const gross = Number(e.amount_eur)
    const rate = Number(e.vat_rate) || 0
    const net = netFromGross(gross, rate)
    const vat = gross - net
    if (e.kind === 'einnahme') {
      einnahmenBrutto += gross; einnahmenNetto += net; umsatzsteuer += vat
    } else {
      ausgabenBrutto += gross; ausgabenNetto += net; vorsteuer += vat
    }
  }
  return {
    einnahmenBrutto, einnahmenNetto, ausgabenBrutto, ausgabenNetto,
    umsatzsteuer, vorsteuer, zahllast: umsatzsteuer - vorsteuer,
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
