create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null,
  shift_slot text not null check (shift_slot in ('Frueh', 'Spaet', 'Nacht')),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  uber_zone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_date, shift_slot, vehicle_id),
  unique (shift_date, shift_slot, driver_id)
);

create table if not exists public.compliance_documents (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('driver', 'vehicle')),
  driver_id uuid references public.drivers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  doc_type text not null check (doc_type in ('pschein', 'hu', 'versicherung', 'uber_freigabe')),
  due_date date not null,
  status text not null check (status in ('valid', 'expiring', 'expired', 'pending')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'driver' and driver_id is not null and vehicle_id is null)
    or (scope_type = 'vehicle' and vehicle_id is not null and driver_id is null)
  )
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null check (incident_type in ('schaeden', 'bussgelder', 'sperrungen')),
  driver_id uuid references public.drivers (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  occurred_on date not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null check (status in ('open', 'in_progress', 'resolved')),
  description text not null,
  cost_eur numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_shift_assignments_updated_at on public.shift_assignments;
create trigger set_shift_assignments_updated_at
before update on public.shift_assignments
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_compliance_documents_updated_at on public.compliance_documents;
create trigger set_compliance_documents_updated_at
before update on public.compliance_documents
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_incidents_updated_at on public.incidents;
create trigger set_incidents_updated_at
before update on public.incidents
for each row
execute procedure public.set_updated_at();

alter table public.shift_assignments enable row level security;
alter table public.compliance_documents enable row level security;
alter table public.incidents enable row level security;

drop policy if exists "Admins full access shift_assignments" on public.shift_assignments;
create policy "Admins full access shift_assignments"
on public.shift_assignments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins full access compliance_documents" on public.compliance_documents;
create policy "Admins full access compliance_documents"
on public.compliance_documents
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins full access incidents" on public.incidents;
create policy "Admins full access incidents"
on public.incidents
for all
to authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shift_assignments'
  ) then
    alter publication supabase_realtime add table public.shift_assignments;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'compliance_documents'
  ) then
    alter publication supabase_realtime add table public.compliance_documents;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incidents'
  ) then
    alter publication supabase_realtime add table public.incidents;
  end if;
end;
$$;
