-- =====================================================================
-- 0021_tank_umsatz.sql
-- Tank-zu-Umsatz-Auswertung je Fahrzeug.
--
-- Zwei Bausteine:
--   1. vehicle_costs.cost_type — strukturiert die bislang freie
--      category-Spalte, damit Tankkosten eindeutig erkannt werden
--      ('tank' | 'reparatur' | 'sonstiges'). category bleibt als frei
--      wählbares Label erhalten.
--   2. vehicle_revenue — Umsatzbuchungen je Fahrzeug (analog vehicle_costs).
--      Finanzdaten sind sensibel: nur Geschäftsführer (owner) und
--      Betriebsleiter (admin) dürfen lesen/schreiben — wie finance_entries
--      (0020) über get_user_admin_company_ids() (aus 0012).
--
-- Die Ratio = Summe Tankkosten / Summe Umsatz * 100 wird in der App
-- berechnet (keine materialisierte Kennzahl nötig).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Strukturierte Kostenart auf vehicle_costs (aus 0018).
-- ---------------------------------------------------------------------
alter table public.vehicle_costs
  add column if not exists cost_type text not null default 'sonstiges'
  check (cost_type in ('tank', 'reparatur', 'sonstiges'));

-- Backfill: bestehende Freitext-Kategorien den Typen zuordnen.
update public.vehicle_costs
  set cost_type = 'tank'
  where cost_type = 'sonstiges'
    and (
      category ilike '%tank%' or
      category ilike '%kraftstoff%' or
      category ilike '%sprit%' or
      category ilike '%diesel%' or
      category ilike '%benzin%' or
      category ilike '%laden%' or
      category ilike '%lade%' or
      category ilike '%strom%'
    );

update public.vehicle_costs
  set cost_type = 'reparatur'
  where cost_type = 'sonstiges'
    and (
      category ilike '%reparat%' or
      category ilike '%wartung%' or
      category ilike '%werkstatt%' or
      category ilike '%service%'
    );

create index if not exists idx_vehicle_costs_type
  on public.vehicle_costs (company_id, cost_type, cost_date);

-- ---------------------------------------------------------------------
-- 2. Umsatzbuchungen je Fahrzeug.
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_revenue (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  revenue_date date not null,
  amount_eur   numeric(12, 2) not null default 0 check (amount_eur >= 0),
  note         text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vehicle_revenue_vehicle
  on public.vehicle_revenue (vehicle_id, revenue_date desc);
create index if not exists idx_vehicle_revenue_company_date
  on public.vehicle_revenue (company_id, revenue_date);

-- updated_at automatisch pflegen (Funktion aus 0001).
drop trigger if exists set_vehicle_revenue_updated_at on public.vehicle_revenue;
create trigger set_vehicle_revenue_updated_at
  before update on public.vehicle_revenue
  for each row execute procedure public.set_updated_at();

-- Audit-Log (Funktion aus 0013).
drop trigger if exists audit_vehicle_revenue on public.vehicle_revenue;
create trigger audit_vehicle_revenue
  after insert or update or delete on public.vehicle_revenue
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS: nur owner/admin der Company (get_user_admin_company_ids aus 0012).
-- ---------------------------------------------------------------------
alter table public.vehicle_revenue enable row level security;

drop policy if exists "admin_select_vehicle_revenue" on public.vehicle_revenue;
create policy "admin_select_vehicle_revenue" on public.vehicle_revenue
  for select to authenticated
  using (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());

drop policy if exists "admin_insert_vehicle_revenue" on public.vehicle_revenue;
create policy "admin_insert_vehicle_revenue" on public.vehicle_revenue
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());

drop policy if exists "admin_update_vehicle_revenue" on public.vehicle_revenue;
create policy "admin_update_vehicle_revenue" on public.vehicle_revenue
  for update to authenticated
  using (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin())
  with check (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());

drop policy if exists "admin_delete_vehicle_revenue" on public.vehicle_revenue;
create policy "admin_delete_vehicle_revenue" on public.vehicle_revenue
  for delete to authenticated
  using (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());

-- ---------------------------------------------------------------------
-- Realtime.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vehicle_revenue'
  ) then
    alter publication supabase_realtime add table public.vehicle_revenue;
  end if;
end $$;
