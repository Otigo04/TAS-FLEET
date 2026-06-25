import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export const AVATAR_BUCKET = 'avatars'
export const DOCUMENT_BUCKET = 'documents'

type Client = SupabaseClient<Database>

/** Macht einen Dateinamen storage-/URL-sicher und begrenzt die Länge. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
  return (cleaned || 'datei').slice(-120)
}

/**
 * Lädt ein zugeschnittenes Avatar-Blob in den öffentlichen `avatars`-Bucket
 * und gibt die öffentliche URL zurück (wird direkt in *.avatar_url gespeichert).
 */
export async function uploadAvatar(
  client: Client,
  pathPrefix: string,
  blob: Blob,
): Promise<string> {
  const path = `${pathPrefix}/${crypto.randomUUID()}.jpg`
  const { error } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export interface UploadedDocument {
  path: string
  size: number
  mime: string
}

/**
 * Lädt eine Datei in den privaten `documents`-Bucket. Erstes Pfadsegment ist
 * die company_id (Tenant-Isolation via Storage-RLS). Gibt den Storage-Pfad
 * zurück — die Metadaten werden separat über recordAttachment() gespeichert.
 */
export async function uploadDocument(
  client: Client,
  companyId: string,
  scopeType: string,
  entityId: string,
  file: File,
): Promise<UploadedDocument> {
  const path = `${companyId}/${scopeType}/${entityId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error } = await client.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  return { path, size: file.size, mime: file.type || 'application/octet-stream' }
}

/** Hübsche Dateigröße (z. B. "1,2 MB") für die UI. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`
}
