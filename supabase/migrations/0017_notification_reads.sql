-- =====================================================================
-- 0017_notification_reads.sql
-- Merkt sich pro Nutzer, welche Frist-Hinweise (Glocke) als gelesen/erledigt
-- markiert wurden. Die Hinweise selbst werden NICHT gespeichert, sondern live
-- aus ablaufenden Fristen (compliance_documents.due_date + P-Schein) berechnet.
--
-- item_key kodiert den konkreten Hinweis, z. B.:
--   compliance:{doc_id}:{due_date}
--   pschein:{driver_id}:{valid_until}
-- Ändert sich das Datum, ändert sich der Key -> der Hinweis gilt wieder als neu.
-- =====================================================================

create table if not exists public.notification_reads (
  user_id    uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  item_key   text not null,
  read_at    timestamptz not null default now(),
  primary key (user_id, company_id, item_key)
);

create index if not exists idx_notification_reads_user_company
  on public.notification_reads (user_id, company_id);

alter table public.notification_reads enable row level security;

-- Jeder Nutzer verwaltet ausschließlich seine eigenen Lese-Markierungen,
-- und nur in Companies, denen er angehört.
drop policy if exists "own_select_notification_reads" on public.notification_reads;
create policy "own_select_notification_reads" on public.notification_reads
  for select to authenticated
  using (user_id = auth.uid() and company_id = any (public.get_user_company_ids()));

drop policy if exists "own_insert_notification_reads" on public.notification_reads;
create policy "own_insert_notification_reads" on public.notification_reads
  for insert to authenticated
  with check (user_id = auth.uid() and company_id = any (public.get_user_company_ids()));

drop policy if exists "own_delete_notification_reads" on public.notification_reads;
create policy "own_delete_notification_reads" on public.notification_reads
  for delete to authenticated
  using (user_id = auth.uid() and company_id = any (public.get_user_company_ids()));

-- Realtime (Badge aktualisiert sich, wenn auf anderem Gerät gelesen wird).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_reads'
  ) then
    alter publication supabase_realtime add table public.notification_reads;
  end if;
end $$;
