'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Send, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'

type NoteRow = Database['public']['Tables']['driver_notes']['Row']

interface DriverNotesProps {
  companyId: string
  driverId: string
  userId: string
  authorName: string
  /** Alt-Notizen aus drivers.notes[] (nur lesbar, ohne Autor/Datum). */
  legacyNotes?: string[]
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DriverNotes({ companyId, driverId, userId, authorName, legacyNotes = [] }: DriverNotesProps) {
  const supabase = useMemo(() => createClient(), [])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('driver_notes')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
    setNotes(data ?? [])
  }, [supabase, driverId])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`driver-notes-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_notes', filter: `driver_id=eq.${driverId}` }, () => void load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, driverId, load])

  async function handleAdd() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('driver_notes').insert({
      company_id: companyId,
      driver_id: driverId,
      author_id: userId,
      author_name: authorName,
      body: trimmed,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      setBody('')
      await load()
    }
  }

  async function handleDelete(id: string) {
    const { error: deleteError } = await supabase.from('driver_notes').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await load()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Notiz hinzufügen…"
          rows={2}
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
        />
        <Button type="button" onClick={() => void handleAdd()} disabled={saving || !body.trim()} className="self-start">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <ul className="space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="group rounded-md border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{note.body}</p>
              <button
                type="button"
                onClick={() => void handleDelete(note.id)}
                className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                title="Notiz löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {note.author_name} · {formatDateTime(note.created_at)}
            </p>
          </li>
        ))}

        {legacyNotes.map((text, i) => (
          <li key={`legacy-${i}`} className="rounded-md border border-dashed border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50 p-3">
            <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{text}</p>
            <p className="mt-1 text-xs text-slate-400">Ältere Notiz</p>
          </li>
        ))}

        {notes.length === 0 && legacyNotes.length === 0 && (
          <li className="text-sm text-slate-400">Noch keine Notizen.</li>
        )}
      </ul>
    </div>
  )
}
