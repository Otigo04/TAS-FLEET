alter table public.drivers add column if not exists avatar_url text;
alter table public.vehicles add column if not exists avatar_url text;

DO $$ 
DECLARE 
  r RECORD;
BEGIN
  -- Drop check constraints for vehicles
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.vehicles'::regclass AND contype = 'c' AND conname LIKE '%status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.vehicles DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  -- Drop check constraints for compliance_documents
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.compliance_documents'::regclass AND contype = 'c' 
      AND (conname LIKE '%status%' OR conname LIKE '%doc_type%')
  ) LOOP
    EXECUTE 'ALTER TABLE public.compliance_documents DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  -- Drop check constraints for incidents
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.incidents'::regclass AND contype = 'c'
      AND (conname LIKE '%status%' OR conname LIKE '%incident_type%' OR conname LIKE '%severity%')
  ) LOOP
    EXECUTE 'ALTER TABLE public.incidents DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  
  -- Drop unique constraint for shift_assignments vehicle_id
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.shift_assignments'::regclass AND contype = 'u'
      AND conname LIKE '%vehicle_id%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.shift_assignments DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "Admins full access settings"
on public.settings
for all
to authenticated
using (true)
with check (true);

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
before update on public.settings
for each row
execute procedure public.set_updated_at();

insert into public.settings (key, value) values
  ('vehicle_statuses', '["active", "maintenance", "offline"]'::jsonb),
  ('document_types', '["pschein", "hu", "versicherung"]'::jsonb),
  ('document_statuses', '["valid", "expiring", "expired", "pending"]'::jsonb),
  ('incident_types', '["schaeden", "bussgelder", "sperrungen"]'::jsonb),
  ('incident_severities', '["low", "medium", "high"]'::jsonb),
  ('incident_statuses', '["open", "in_progress", "resolved"]'::jsonb)
on conflict (key) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end;
$$;
