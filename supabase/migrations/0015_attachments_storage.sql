-- =====================================================================
-- 0015_attachments_storage.sql
-- Datei-Anhänge + Supabase Storage.
--
-- Dateien werden NICHT in der Datenbank gespeichert, sondern in Storage-
-- Buckets. In der DB liegt nur ein schlanker Verweis (storage_path).
--
--   * Bucket 'avatars'   : öffentlich lesbar (Profil-/Fahrer-/Fahrzeug-
--                          bilder, Firmenlogo). Schreiben nur authentifiziert.
--   * Bucket 'documents' : privat (sensible Dateien: P-Schein, Verträge,
--                          Schadensfotos, Fahrzeugpapiere). Zugriff nur via
--                          Signed URL und nur für Mitglieder der Company,
--                          deren ID im ersten Pfadsegment steht.
--
-- Pfad-Konvention documents: {company_id}/{scope}/{entity_id}/{uuid}-{name}
-- =====================================================================

-- ---------------------------------------------------------------------
-- Metadaten-Tabelle der Anhänge.
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  scope_type       text not null check (scope_type in ('driver', 'vehicle', 'incident', 'compliance', 'company')),
  entity_id        uuid not null,
  label            text,
  storage_path     text not null,
  mime_type        text,
  size_bytes       integer,
  uploaded_by      uuid,
  uploaded_by_name text not null default 'System',
  created_at       timestamptz not null default now()
);

create index if not exists idx_attachments_company on public.attachments (company_id);
create index if not exists idx_attachments_entity on public.attachments (scope_type, entity_id);

-- Audit-Log (Funktion aus 0013) — protokolliert Upload/Löschung.
drop trigger if exists audit_attachments on public.attachments;
create trigger audit_attachments
  after insert or update or delete on public.attachments
  for each row execute function public.audit_trigger();

-- RLS: alle Mitglieder der Company dürfen lesen/anlegen/löschen.
alter table public.attachments enable row level security;

drop policy if exists "tenant_select_attachments" on public.attachments;
create policy "tenant_select_attachments" on public.attachments
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_insert_attachments" on public.attachments;
create policy "tenant_insert_attachments" on public.attachments
  for insert to authenticated
  with check (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_delete_attachments" on public.attachments;
create policy "tenant_delete_attachments" on public.attachments
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    alter publication supabase_realtime add table public.attachments;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage-Buckets.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Storage-RLS-Policies (auf storage.objects).
-- CREATE POLICY kennt kein IF NOT EXISTS -> drop + create für Idempotenz.
-- ---------------------------------------------------------------------

-- avatars: öffentlich lesbar, Schreiben für angemeldete Nutzer.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_insert" on storage.objects;
create policy "avatars_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');

-- documents: nur Mitglieder der Company (erstes Pfadsegment = company_id).
drop policy if exists "documents_tenant_read" on storage.objects;
create policy "documents_tenant_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = any (public.get_user_company_ids()::text[])
  );

drop policy if exists "documents_tenant_insert" on storage.objects;
create policy "documents_tenant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = any (public.get_user_company_ids()::text[])
  );

drop policy if exists "documents_tenant_delete" on storage.objects;
create policy "documents_tenant_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = any (public.get_user_company_ids()::text[])
  );
