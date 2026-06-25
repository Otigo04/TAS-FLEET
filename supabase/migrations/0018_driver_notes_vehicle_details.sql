-- =====================================================================
-- 0018_driver_notes_vehicle_details.sql
-- Phase 4: Fahrer-Notizen mit Verlauf + erweiterte (optionale) Fahrzeugdaten
-- inkl. Wartungs-/Service-Historie und Betriebskosten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fahrer-Notizen mit Autor + Zeitstempel (ersetzt nach und nach das
-- einfache drivers.notes[]-Array; Altbestand bleibt lesbar).
-- ---------------------------------------------------------------------
create table if not exists public.driver_notes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  author_id   uuid,
  author_name text not null default 'Unbekannt',
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_driver_notes_driver on public.driver_notes (driver_id, created_at desc);

alter table public.driver_notes enable row level security;

drop policy if exists "tenant_select_driver_notes" on public.driver_notes;
create policy "tenant_select_driver_notes" on public.driver_notes
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_insert_driver_notes" on public.driver_notes;
create policy "tenant_insert_driver_notes" on public.driver_notes
  for insert to authenticated
  with check (company_id = any (public.get_user_company_ids()));

drop policy if exists "tenant_delete_driver_notes" on public.driver_notes;
create policy "tenant_delete_driver_notes" on public.driver_notes
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_notes'
  ) then
    alter publication supabase_realtime add table public.driver_notes;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Erweiterte (optionale) Fahrzeug-Stammdaten — alle nullable.
-- ---------------------------------------------------------------------
alter table public.vehicles add column if not exists build_year        integer;
alter table public.vehicles add column if not exists vin               text;
alter table public.vehicles add column if not exists color             text;
alter table public.vehicles add column if not exists fuel_type         text;
alter table public.vehicles add column if not exists hu_due            date;
alter table public.vehicles add column if not exists insurance_company text;
alter table public.vehicles add column if not exists insurance_number  text;
alter table public.vehicles add column if not exists insurance_due     date;
alter table public.vehicles add column if not exists purchase_date     date;
alter table public.vehicles add column if not exists mileage_km        integer;

-- ---------------------------------------------------------------------
-- Wartungs-/Service-Historie.
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_maintenance (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  vehicle_id    uuid not null references public.vehicles (id) on delete cascade,
  service_date  date not null,
  service_type  text not null,
  mileage_km    integer,
  cost_eur      numeric(10, 2) not null default 0,
  note          text,
  next_due_date date,
  next_due_km   integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_vehicle_maintenance_vehicle on public.vehicle_maintenance (vehicle_id, service_date desc);

drop trigger if exists set_vehicle_maintenance_updated_at on public.vehicle_maintenance;
create trigger set_vehicle_maintenance_updated_at
  before update on public.vehicle_maintenance
  for each row execute procedure public.set_updated_at();

drop trigger if exists audit_vehicle_maintenance on public.vehicle_maintenance;
create trigger audit_vehicle_maintenance
  after insert or update or delete on public.vehicle_maintenance
  for each row execute function public.audit_trigger();

alter table public.vehicle_maintenance enable row level security;

drop policy if exists "tenant_all_vehicle_maintenance" on public.vehicle_maintenance;
create policy "tenant_all_vehicle_maintenance" on public.vehicle_maintenance
  for all to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));

-- ---------------------------------------------------------------------
-- Betriebskosten (Tank, Reparatur, Sonstiges).
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_costs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  cost_date  date not null,
  category   text not null,
  amount_eur numeric(10, 2) not null default 0,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_costs_vehicle on public.vehicle_costs (vehicle_id, cost_date desc);

drop trigger if exists audit_vehicle_costs on public.vehicle_costs;
create trigger audit_vehicle_costs
  after insert or update or delete on public.vehicle_costs
  for each row execute function public.audit_trigger();

alter table public.vehicle_costs enable row level security;

drop policy if exists "tenant_all_vehicle_costs" on public.vehicle_costs;
create policy "tenant_all_vehicle_costs" on public.vehicle_costs
  for all to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));

-- Realtime für beide neuen Tabellen.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vehicle_maintenance') then
    alter publication supabase_realtime add table public.vehicle_maintenance;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vehicle_costs') then
    alter publication supabase_realtime add table public.vehicle_costs;
  end if;
end $$;
