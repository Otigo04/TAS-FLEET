-- =====================================================================
-- 0016_timesheets.sql
-- Stundenzettel serverseitig speichern (vorher nur localStorage im Browser
-- -> Datenverlust-Risiko, nicht teamweit sichtbar).
--
-- Die Eingabefelder bleiben Freitext (start/end/pause/work/overtime), damit
-- nichts verloren geht. Zusätzlich werden numerische Spalten gepflegt
-- (work_hours_num / overtime_num) für das Monats-Stundenkonto.
--
-- Rechte: jedes Company-Mitglied darf erfassen (wie Abwesenheiten).
-- =====================================================================

create table if not exists public.timesheet_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  driver_id       uuid not null references public.drivers (id) on delete cascade,
  work_date       date not null,
  start_time      text,
  end_time        text,
  pause           text,
  work_hours      text,
  overtime_hours  text,
  work_hours_num  numeric not null default 0,
  overtime_num    numeric not null default 0,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, driver_id, work_date)
);

create index if not exists idx_timesheets_company on public.timesheet_entries (company_id);
create index if not exists idx_timesheets_driver_date on public.timesheet_entries (driver_id, work_date);

-- Optionales Soll-Stunden-Feld je Fahrer (für Soll/Ist im Stundenkonto).
alter table public.drivers add column if not exists weekly_target_hours numeric;

-- updated_at automatisch pflegen (Funktion aus 0001).
drop trigger if exists set_timesheets_updated_at on public.timesheet_entries;
create trigger set_timesheets_updated_at
  before update on public.timesheet_entries
  for each row execute procedure public.set_updated_at();

-- Audit-Log (Funktion aus 0013).
drop trigger if exists audit_timesheets on public.timesheet_entries;
create trigger audit_timesheets
  after insert or update or delete on public.timesheet_entries
  for each row execute function public.audit_trigger();

-- RLS: alle Mitglieder der Company dürfen lesen und schreiben.
alter table public.timesheet_entries enable row level security;

drop policy if exists "tenant_select_timesheets" on public.timesheet_entries;
create policy "tenant_select_timesheets" on public.timesheet_entries
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_insert_timesheets" on public.timesheet_entries;
create policy "tenant_insert_timesheets" on public.timesheet_entries
  for insert to authenticated
  with check (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_update_timesheets" on public.timesheet_entries;
create policy "tenant_update_timesheets" on public.timesheet_entries
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_delete_timesheets" on public.timesheet_entries;
create policy "tenant_delete_timesheets" on public.timesheet_entries
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timesheet_entries'
  ) then
    alter publication supabase_realtime add table public.timesheet_entries;
  end if;
end $$;
