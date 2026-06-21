-- =====================================================================
-- 0009_multi_tenant.sql
-- Converts the single-tenant ON Mobility portal into a multi-tenant
-- (B2B SaaS) architecture with strict per-company data isolation.
--
-- Steps in this migration:
--   1. companies, company_role enum, company_users mapping table
--   2. company_id column on all business tables
--   3. Tenant helper functions (get_user_company_ids / admin variant)
--   4. Data backfill into a default company (keeps existing app working)
--   5. NOT NULL + indexes on company_id
--   6. Drop old permissive RLS, add strict tenant RLS
--   7. companies / company_users RLS
--   8. create_company_with_owner() bootstrap RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: Core tenant tables
-- ---------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Postgres has no "create type if not exists", so guard it.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'company_role') then
    create type public.company_role as enum ('owner', 'admin', 'member');
  end if;
end $$;

create table if not exists public.company_users (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.company_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists idx_company_users_user on public.company_users (user_id);

-- ---------------------------------------------------------------------
-- STEP 2: Add company_id to every business table (nullable for now,
--         tightened to NOT NULL after the backfill below).
-- ---------------------------------------------------------------------

alter table public.drivers
  add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.vehicles
  add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.shift_assignments
  add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.compliance_documents
  add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.incidents
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

-- ---------------------------------------------------------------------
-- STEP 3: Tenant helper functions.
-- SECURITY DEFINER so they read company_users without tripping RLS
-- (and so they can be safely used *inside* company_users' own policies).
-- ---------------------------------------------------------------------

create or replace function public.get_user_company_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(company_id), '{}')
  from public.company_users
  where user_id = auth.uid();
$$;

create or replace function public.get_user_admin_company_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(company_id), '{}')
  from public.company_users
  where user_id = auth.uid()
    and role in ('owner', 'admin');
$$;

-- ---------------------------------------------------------------------
-- STEP 4: Backfill. Without this, every existing row (company_id NULL)
-- would become invisible under the new RLS. Creates a default company,
-- makes all current users 'owner', and stamps existing data.
-- ---------------------------------------------------------------------

do $$
declare
  default_company_id uuid;
begin
  select id into default_company_id from public.companies where slug = 'on-mobility';

  if default_company_id is null then
    insert into public.companies (name, slug)
    values ('ON Mobility', 'on-mobility')
    returning id into default_company_id;
  end if;

  insert into public.company_users (company_id, user_id, role)
  select default_company_id, id, 'owner' from auth.users
  on conflict (company_id, user_id) do nothing;

  update public.drivers              set company_id = default_company_id where company_id is null;
  update public.vehicles             set company_id = default_company_id where company_id is null;
  update public.shift_assignments    set company_id = default_company_id where company_id is null;
  update public.compliance_documents set company_id = default_company_id where company_id is null;
  update public.incidents            set company_id = default_company_id where company_id is null;
end $$;

-- ---------------------------------------------------------------------
-- STEP 5: Enforce NOT NULL + index company_id on each table.
-- ---------------------------------------------------------------------

alter table public.drivers              alter column company_id set not null;
alter table public.vehicles             alter column company_id set not null;
alter table public.shift_assignments    alter column company_id set not null;
alter table public.compliance_documents alter column company_id set not null;
alter table public.incidents            alter column company_id set not null;

create index if not exists idx_drivers_company              on public.drivers (company_id);
create index if not exists idx_vehicles_company             on public.vehicles (company_id);
create index if not exists idx_shift_assignments_company    on public.shift_assignments (company_id);
create index if not exists idx_compliance_documents_company on public.compliance_documents (company_id);
create index if not exists idx_incidents_company            on public.incidents (company_id);

-- ---------------------------------------------------------------------
-- STEP 6: Replace permissive RLS with strict tenant isolation.
-- The old "Admins full access ..." policies used `using (true)` and MUST
-- be dropped — otherwise they OR with the new ones and defeat isolation.
--   SELECT / UPDATE / DELETE -> any company the user belongs to
--   INSERT                   -> only companies where user is owner/admin
-- ---------------------------------------------------------------------

-- Macro-style block: applied identically to each business table.
-- drivers ------------------------------------------------------------
drop policy if exists "Admins full access drivers" on public.drivers;
create policy "tenant_select_drivers" on public.drivers
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_drivers" on public.drivers
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_update_drivers" on public.drivers
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_delete_drivers" on public.drivers
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- vehicles -----------------------------------------------------------
drop policy if exists "Admins full access vehicles" on public.vehicles;
create policy "tenant_select_vehicles" on public.vehicles
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_vehicles" on public.vehicles
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_update_vehicles" on public.vehicles
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_delete_vehicles" on public.vehicles
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- shift_assignments --------------------------------------------------
drop policy if exists "Admins full access shift_assignments" on public.shift_assignments;
create policy "tenant_select_shift_assignments" on public.shift_assignments
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_shift_assignments" on public.shift_assignments
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_update_shift_assignments" on public.shift_assignments
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_delete_shift_assignments" on public.shift_assignments
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- compliance_documents -----------------------------------------------
drop policy if exists "Admins full access compliance_documents" on public.compliance_documents;
create policy "tenant_select_compliance_documents" on public.compliance_documents
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_compliance_documents" on public.compliance_documents
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_update_compliance_documents" on public.compliance_documents
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_delete_compliance_documents" on public.compliance_documents
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- incidents ----------------------------------------------------------
drop policy if exists "Admins full access incidents" on public.incidents;
create policy "tenant_select_incidents" on public.incidents
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_incidents" on public.incidents
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_update_incidents" on public.incidents
  for update to authenticated
  using (company_id = any (public.get_user_company_ids()))
  with check (company_id = any (public.get_user_company_ids()));
create policy "tenant_delete_incidents" on public.incidents
  for delete to authenticated
  using (company_id = any (public.get_user_company_ids()));

-- ---------------------------------------------------------------------
-- STEP 6b: Make the settings table per-tenant. Its primary key changes
-- from (key) to (company_id, key) so each company keeps its own config
-- lists. Existing global rows move to the default company.
-- ---------------------------------------------------------------------

alter table public.settings
  add column if not exists company_id uuid references public.companies (id) on delete cascade;

update public.settings
  set company_id = (select id from public.companies where slug = 'on-mobility')
  where company_id is null;

alter table public.settings alter column company_id set not null;

alter table public.settings drop constraint if exists settings_pkey;
alter table public.settings add primary key (company_id, key);

create index if not exists idx_settings_company on public.settings (company_id);

drop policy if exists "Admins full access settings" on public.settings;
create policy "tenant_select_settings" on public.settings
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "tenant_insert_settings" on public.settings
  for insert to authenticated
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_update_settings" on public.settings
  for update to authenticated
  using (company_id = any (public.get_user_admin_company_ids()))
  with check (company_id = any (public.get_user_admin_company_ids()));
create policy "tenant_delete_settings" on public.settings
  for delete to authenticated
  using (company_id = any (public.get_user_admin_company_ids()));

-- ---------------------------------------------------------------------
-- STEP 7: RLS for the tenant tables themselves.
-- ---------------------------------------------------------------------

alter table public.companies      enable row level security;
alter table public.company_users  enable row level security;

-- Companies: members can read; owners/admins can rename.
-- (No INSERT policy on purpose — creation goes through the SECURITY
--  DEFINER RPC below, which is the only sanctioned way to bootstrap.)
create policy "members_select_companies" on public.companies
  for select to authenticated
  using (id = any (public.get_user_company_ids()));
create policy "admins_update_companies" on public.companies
  for update to authenticated
  using (id = any (public.get_user_admin_company_ids()))
  with check (id = any (public.get_user_admin_company_ids()));

-- Company memberships: members can see who is in their companies;
-- only owners/admins can add/change/remove members.
create policy "members_select_company_users" on public.company_users
  for select to authenticated
  using (company_id = any (public.get_user_company_ids()));
create policy "admins_manage_company_users" on public.company_users
  for all to authenticated
  using (company_id = any (public.get_user_admin_company_ids()))
  with check (company_id = any (public.get_user_admin_company_ids()));

-- ---------------------------------------------------------------------
-- STEP 8: Bootstrap RPC. Atomically creates a company and makes the
-- caller its 'owner'. SECURITY DEFINER avoids the RLS chicken-and-egg.
-- ---------------------------------------------------------------------

create or replace function public.create_company_with_owner(company_name text)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company public.companies;
  base_slug   text;
  final_slug  text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if company_name is null or length(trim(company_name)) = 0 then
    raise exception 'Company name must not be empty';
  end if;

  -- slugify: lower-case, non-alphanumerics -> '-', trimmed; uniqueness
  -- guaranteed by a short random suffix to avoid retry loops.
  base_slug := trim(both '-' from regexp_replace(lower(trim(company_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'company'; end if;
  final_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.companies (name, slug)
  values (trim(company_name), final_slug)
  returning * into new_company;

  insert into public.company_users (company_id, user_id, role)
  values (new_company.id, auth.uid(), 'owner');

  -- Seed the new company's configuration lists (mirrors the global
  -- defaults from migration 0007, now scoped per tenant).
  insert into public.settings (company_id, key, value) values
    (new_company.id, 'vehicle_statuses',   '["active", "maintenance", "offline"]'::jsonb),
    (new_company.id, 'document_types',      '["pschein", "hu", "versicherung"]'::jsonb),
    (new_company.id, 'document_statuses',   '["valid", "expiring", "expired", "pending"]'::jsonb),
    (new_company.id, 'incident_types',      '["schaeden", "bussgelder", "sperrungen"]'::jsonb),
    (new_company.id, 'incident_severities', '["low", "medium", "high"]'::jsonb),
    (new_company.id, 'incident_statuses',   '["open", "in_progress", "resolved"]'::jsonb)
  on conflict (company_id, key) do nothing;

  return new_company;
end;
$$;

revoke all on function public.create_company_with_owner(text) from public;
grant execute on function public.create_company_with_owner(text) to authenticated;

-- Realtime for the tenant tables (optional but consistent with the rest).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'company_users'
  ) then
    alter publication supabase_realtime add table public.company_users;
  end if;
end $$;
