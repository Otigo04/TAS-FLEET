'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'
import { auditActionLabel, fieldLabel, labelFor, tableLabel, TABLE_LABELS } from '@/lib/labels'

type AuditRow = Database['public']['Tables']['audit_log']['Row']

interface AuditLogViewProps {
  initialEntries: AuditRow[]
}

const IGNORED_FIELDS = new Set(['id', 'company_id', 'created_at', 'updated_at'])
const LABELLED_FIELDS = new Set([
  'status',
  'severity',
  'incident_type',
  'doc_type',
  'current_shift',
  'shift_slot',
])

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein'
  if (LABELLED_FIELDS.has(key)) return labelFor(String(value))
  return String(value)
}

type Json = Record<string, unknown>

function changedFields(oldData: Json | null, newData: Json | null): string[] {
  if (!oldData || !newData) return []
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
  const changed: string[] = []
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) changed.push(key)
  }
  return changed
}

function actionVisual(action: AuditRow['action']) {
  if (action === 'insert') return { Icon: Plus, variant: 'success' as const }
  if (action === 'delete') return { Icon: Trash2, variant: 'danger' as const }
  return { Icon: Pencil, variant: 'warning' as const }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditLogView({ initialEntries }: AuditLogViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const [entries, setEntries] = useState<AuditRow[]>(initialEntries)
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')

  async function refresh() {
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300)
    setEntries(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('audit-log-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, companyId])

  const filtered = entries.filter((e) => {
    const tableMatch = tableFilter === 'all' || e.table_name === tableFilter
    const actionMatch = actionFilter === 'all' || e.action === actionFilter
    return tableMatch && actionMatch
  })

  return (
    <Card className="surface-card animate-fade-up-delay">
      <CardHeader>
        <CardTitle>Änderungsverlauf</CardTitle>
        <CardDescription>Wer hat wann was geändert (neueste zuerst, max. 300 Einträge)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <select
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          >
            <option value="all">Alle Bereiche</option>
            {Object.keys(TABLE_LABELS).map((t) => (
              <option key={t} value={t}>
                {tableLabel(t)}
              </option>
            ))}
          </select>
          <select
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">Alle Aktionen</option>
            <option value="insert">Erstellt</option>
            <option value="update">Geändert</option>
            <option value="delete">Gelöscht</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Einträge vorhanden.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((entry) => {
              const { Icon, variant } = actionVisual(entry.action)
              const fields = changedFields(
                entry.old_data as Json | null,
                entry.new_data as Json | null,
              )

              return (
                <li key={entry.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {auditActionLabel(entry.action)}
                      </Badge>
                      <Badge variant="secondary">{tableLabel(entry.table_name)}</Badge>
                    </div>
                    <span className="text-xs text-slate-500">{formatTimestamp(entry.created_at)}</span>
                  </div>

                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{entry.actor_name}</span>
                    {entry.action === 'insert' && ' hat einen neuen Eintrag erstellt.'}
                    {entry.action === 'delete' && ' hat den Eintrag gelöscht.'}
                    {entry.action === 'update' && ' hat den Eintrag geändert.'}
                  </p>

                  {entry.action === 'update' && fields.length > 0 ? (
                    <ul className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50/60 p-3 text-xs">
                      {fields.map((key) => (
                        <li key={key} className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-600">{fieldLabel(key)}:</span>
                          <span className="text-slate-400 line-through">
                            {formatValue(key, (entry.old_data as Json)?.[key])}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="font-medium text-slate-900">
                            {formatValue(key, (entry.new_data as Json)?.[key])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
