-- =====================================================================
-- 0014_absences.sql
-- Abwesenheiten (Urlaub / Krankheit / Sonstiges) je Fahrer. In der
-- Disposition werden Fahrer, die an dem Tag abwesend sind, ausgegraut
-- bzw. blockiert.
--
-- Rechte: jedes Company-Mitglied (auch der Disponent) darf Abwesenheiten
-- verwalten (Capability 'manageAbsences').
-- =====================================================================

create table if not exists public.absences (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  type        text not null check (type in ('urlaub', 'krankheit', 'sonstiges')),
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_absences_company on public.absences (company_id);
create index if not exists idx_absences_driver on public.absences (driver_id);
create index if not exists idx_absences_range on public.absences (company_id, start_date, end_date);

-- updated_at automatisch pflegen (Funktion aus 0001).
drop trigger if exists set_absences_updated_at on public.absences;
create trigger set_absences_updated_at
  before update on public.absences
  for each row execute procedure public.set_updated_at();

-- Audit-Log (Funktion aus 0013).
drop trigger if exists audit_absences on public.absences;
create trigger audit_absences
  after insert or update or delete on public.absences
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS: alle Mitglieder der Company dürfen lesen und schreiben.
-- ---------------------------------------------------------------------
alter table public.absences enable row level security;

create policy "tenant_select_absences" on public.absences
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_absences" on public.absences
  for insert to authenticated
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_update_absences" on public.absences
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_delete_absences" on public.absences
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'absences'
  ) then
    alter publication supabase_realtime add table public.absences;
  end if;
end $$;
