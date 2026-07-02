-- =====================================================================
-- 0020_finance.sql
-- GuV / EÜR: manuelle Einnahmen- und Ausgaben-Buchungen je Unternehmen.
-- Grundlage für die Finanzen-Seite (Gewinnermittlung + Steuerschätzung:
-- Gewerbesteuer, Körperschaftsteuer, Solidaritätszuschlag).
--
-- Rechte: Finanzdaten sind sensibel — nur Geschäftsführer (owner) und
-- Betriebsleiter (admin) dürfen lesen und schreiben. Dafür wird die
-- bestehende Funktion get_user_admin_company_ids() (aus 0012) genutzt.
-- Die Rechtsform/Hebesatz-Konfiguration liegt als JSON in settings
-- (key 'finance_config') — keine eigene Tabelle nötig.
-- =====================================================================

create table if not exists public.finance_entries (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  entry_date  date not null,
  kind        text not null check (kind in ('einnahme', 'ausgabe')),
  category    text not null default 'Sonstiges',
  description text,
  amount_eur  numeric(12, 2) not null check (amount_eur >= 0),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_finance_company on public.finance_entries (company_id);
create index if not exists idx_finance_company_date on public.finance_entries (company_id, entry_date);

-- updated_at automatisch pflegen (Funktion aus 0001).
drop trigger if exists set_finance_entries_updated_at on public.finance_entries;
create trigger set_finance_entries_updated_at
  before update on public.finance_entries
  for each row execute procedure public.set_updated_at();

-- Audit-Log (Funktion aus 0013).
drop trigger if exists audit_finance_entries on public.finance_entries;
create trigger audit_finance_entries
  after insert or update or delete on public.finance_entries
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS: nur owner/admin der Company (get_user_admin_company_ids).
-- ---------------------------------------------------------------------
alter table public.finance_entries enable row level security;

create policy "admin_select_finance" on public.finance_entries
  for select to authenticated
  using (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());
create policy "admin_insert_finance" on public.finance_entries
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());
create policy "admin_update_finance" on public.finance_entries
  for update to authenticated
  using (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin())
  with check (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());
create policy "admin_delete_finance" on public.finance_entries
  for delete to authenticated
  using (company_id = any (public.get_user_admin_company_ids()) or public.is_superadmin());

-- Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'finance_entries'
  ) then
    alter publication supabase_realtime add table public.finance_entries;
  end if;
end $$;
