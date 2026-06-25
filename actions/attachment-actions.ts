'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { getUserCompanies } from '@/lib/tenant'
import { DOCUMENT_BUCKET } from '@/lib/storage'

type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string }

const SCOPE = ['driver', 'vehicle', 'incident', 'compliance', 'company'] as const

const recordSchema = z.object({
  companyId: z.uuid(),
  scopeType: z.enum(SCOPE),
  entityId: z.uuid(),
  storagePath: z.string().min(1),
  label: z.string().trim().max(200).optional(),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
})

/**
 * Speichert die Metadaten eines bereits in den `documents`-Bucket geladenen
 * Anhangs. Die eigentliche Datei lädt der Client direkt hoch (siehe
 * lib/storage.uploadDocument), damit große Dateien nicht durch die Action
 * serialisiert werden.
 */
export async function recordAttachment(
  input: z.infer<typeof recordSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recordSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Nicht authentifiziert.' }

  const companies = await getUserCompanies()
  if (!companies.some((c) => c.id === parsed.data.companyId)) {
    return { success: false, error: 'Keine Berechtigung für dieses Unternehmen.' }
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()
  const actorName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email || 'Unbekannt'

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      company_id: parsed.data.companyId,
      scope_type: parsed.data.scopeType,
      entity_id: parsed.data.entityId,
      storage_path: parsed.data.storagePath,
      label: parsed.data.label ?? null,
      mime_type: parsed.data.mimeType ?? null,
      size_bytes: parsed.data.sizeBytes ?? null,
      uploaded_by: user.id,
      uploaded_by_name: actorName,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Anhang konnte nicht gespeichert werden.' }
  }
  return { success: true, data: { id: data.id } }
}

/** Erzeugt eine temporäre Signed URL zum Herunterladen/Ansehen eines Anhangs. */
export async function getAttachmentSignedUrl(
  storagePath: string,
): Promise<ActionResult<{ url: string }>> {
  if (!storagePath) return { success: false, error: 'Kein Pfad angegeben.' }

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (error || !data?.signedUrl) {
    return { success: false, error: error?.message ?? 'Link konnte nicht erstellt werden.' }
  }
  return { success: true, data: { url: data.signedUrl } }
}

/** Löscht einen Anhang inkl. Datei aus dem Storage. */
export async function deleteAttachment(id: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { success: false, error: 'Ungültige ID.' }

  const supabase = await createClient()
  // RLS stellt sicher, dass nur Anhänge der eigenen Companies sichtbar sind.
  const { data: row, error: fetchError } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('id', parsed.data)
    .maybeSingle()

  if (fetchError) return { success: false, error: fetchError.message }
  if (!row) return { success: false, error: 'Anhang nicht gefunden.' }

  // Erst Datei, dann Metadaten (Storage-RLS schützt vor Fremdzugriff).
  const { error: storageError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .remove([row.storage_path])
  if (storageError) return { success: false, error: storageError.message }

  const { error: deleteError } = await supabase.from('attachments').delete().eq('id', parsed.data)
  if (deleteError) return { success: false, error: deleteError.message }

  return { success: true }
}
