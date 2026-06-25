/**
 * Wandelt einen Stunden-Freitext in eine Dezimalzahl um.
 * Akzeptiert "8", "8,5", "8.5" und "8:30" (= 8,5 h). Ungültiges -> 0.
 * Geteilt zwischen Stundenzettel-UI und serverseitigem Monats-Stundenkonto.
 */
export function parseHourValue(value: string | null | undefined): number {
  const normalized = (value ?? '').trim().replace(',', '.')
  if (!normalized) return 0

  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    const [hoursPart, minutesPart] = normalized.split(':')
    const hours = Number(hoursPart)
    const minutes = Number(minutesPart)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours + minutes / 60
    }
  }

  const numberValue = Number(normalized)
  return Number.isNaN(numberValue) ? 0 : numberValue
}

/** Formatiert Dezimalstunden deutsch ("8,50"). */
export function formatHours(value: number): string {
  return value.toFixed(2).replace('.', ',')
}
