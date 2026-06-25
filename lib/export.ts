/**
 * Generischer CSV-Export (Semikolon-getrennt, UTF-8 BOM für Excel-Kompatibilität).
 * Geteilt von allen Listen-Modulen, statt die Logik je Komponente zu duplizieren.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map((row) => row.map(esc).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** YYYY-MM-DD von heute für Dateinamen. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
