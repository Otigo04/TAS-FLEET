'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Paperclip, Upload, Download, Trash2, Loader2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadDocument, formatFileSize } from '@/lib/storage'
import { recordAttachment, deleteAttachment, getAttachmentSignedUrl } from '@/actions/attachment-actions'
import type { Database } from '@/lib/supabase/database.types'

type AttachmentRow = Database['public']['Tables']['attachments']['Row']
type ScopeType = AttachmentRow['scope_type']

interface AttachmentListProps {
  companyId: string
  scopeType: ScopeType
  entityId: string
  /** Wenn false, ist nur Ansehen/Herunterladen möglich (kein Upload/Löschen). */
  canEdit?: boolean
  /** Maximale Dateigröße in MB (Default 10). */
  maxSizeMb?: number
}

export function AttachmentList({
  companyId,
  scopeType,
  entityId,
  canEdit = true,
  maxSizeMb = 10,
}: AttachmentListProps) {
  const [items, setItems] = useState<AttachmentRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('attachments')
      .select('*')
      .eq('scope_type', scopeType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }, [supabase, scopeType, entityId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`attachments-${scopeType}-${entityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attachments', filter: `entity_id=eq.${entityId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, scopeType, entityId, load])

  async function handleFiles(files: FileList) {
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > maxSizeMb * 1024 * 1024) {
          setError(`„${file.name}" ist größer als ${maxSizeMb} MB.`)
          continue
        }
        const uploaded = await uploadDocument(supabase, companyId, scopeType, entityId, file)
        const res = await recordAttachment({
          companyId,
          scopeType,
          entityId,
          storagePath: uploaded.path,
          label: file.name,
          mimeType: uploaded.mime,
          sizeBytes: uploaded.size,
        })
        if (!res.success) {
          // Verwaiste Datei wieder entfernen, damit kein Storage-Müll bleibt.
          await supabase.storage.from('documents').remove([uploaded.path])
          setError(res.error)
        }
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(item: AttachmentRow) {
    setBusyId(item.id)
    setError(null)
    const res = await getAttachmentSignedUrl(item.storage_path)
    setBusyId(null)
    if (res.success) {
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } else {
      setError(res.error)
    }
  }

  async function handleDelete(item: AttachmentRow) {
    if (!confirm(`Anhang „${item.label ?? 'Datei'}" wirklich löschen?`)) return
    setBusyId(item.id)
    setError(null)
    const res = await deleteAttachment(item.id)
    setBusyId(null)
    if (!res.success) setError(res.error)
    else await load()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Paperclip className="h-3.5 w-3.5" />
          Dateien {items.length > 0 ? `(${items.length})` : ''}
        </p>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Hochladen
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Keine Dateien hinterlegt.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700/60">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-700 dark:text-slate-300">{item.label ?? 'Datei'}</p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(item.size_bytes)}
                  {item.uploaded_by_name ? ` · ${item.uploaded_by_name}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(item)}
                disabled={busyId === item.id}
                className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 disabled:opacity-50"
                title="Öffnen / Herunterladen"
              >
                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
