'use client'

import { useMemo, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type EditableField = 'weekly_target_hours' | 'annual_vacation_days'

interface DriverNumberFieldProps {
  driverId: string
  field: EditableField
  label: string
  initial: number | null
  placeholder?: string
}

/** Optionales Zahlenfeld je Fahrer (Wochensoll / Urlaubskontingent). */
export function DriverNumberField({ driverId, field, label, initial, placeholder }: DriverNumberFieldProps) {
  const supabase = useMemo(() => createClient(), [])
  const [value, setValue] = useState(initial != null ? String(initial) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const trimmed = value.trim().replace(',', '.')
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed !== null && Number.isNaN(parsed)) {
      setError('Bitte eine Zahl eingeben.')
      setSaving(false)
      return
    }
    const payload: Database['public']['Tables']['drivers']['Update'] = {}
    ;(payload as Record<string, number | null>)[field] = parsed
    const { error: updateError } = await supabase.from('drivers').update(payload).eq('id', driverId)
    setSaving(false)
    if (updateError) setError(updateError.message)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <label htmlFor={`field-${field}`} className="text-xs text-slate-500">
          {label} <span className="text-slate-400">— optional</span>
        </label>
        <Input
          id={`field-${field}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          inputMode="decimal"
          className="w-28"
        />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-brand-700" /> : 'Speichern'}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
