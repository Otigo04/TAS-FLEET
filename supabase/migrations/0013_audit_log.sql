-- =====================================================================
-- 0013_audit_log.sql
-- Änderungshistorie / Audit-Log. Ein zentraler, trigger-basierter Ansatz
-- erfasst JEDE Änderung an den Geschäftsdaten – unabhängig davon, ob sie
-- aus der App, dem Import oder der Superadmin-Konsole kam.
--
-- Designentscheidungen:
--   * Snapshot von Akteur-Name + alten/neuen Werten direkt beim Schreiben
--     (immutabel, unabhängig von späteren Profil-/RLS-Änderungen).
--   * SECURITY DEFINER Trigger: darf auth.users/profiles lesen und schreibt
--     am RLS vorbei in audit_log.
--   * Lesen nur für Geschäftsführer/Betriebsleiter (get_user_admin_company_ids).
-- =====================================================================

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  actor_id    uuid,
  actor_name  text not null default 'System',
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_company_created
  on public.audit_log (company_id, created_at desc);
create index if not exists idx_audit_log_record
  on public.audit_log (table_name, record_id);

-- ---------------------------------------------------------------------
-- Generische Trigger-Funktion.
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_record_id  uuid;
  v_actor      text;
  v_old        jsonb;
  v_new        jsonb;
begin
  if (tg_op = 'DELETE') then
    v_company_id := old.company_id;
    v_record_id  := old.id;
    v_old := to_jsonb(old);
    v_new := null;
  elsif (tg_op = 'INSERT') then
    v_company_id := new.company_id;
    v_record_id  := new.id;
    v_old := null;
    v_new := to_jsonb(new);
  else -- UPDATE
    v_company_id := new.company_id;
    v_record_id  := new.id;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    -- Reine No-op-Updates (nichts außer updated_at geändert) nicht protokollieren.
    if (v_old - 'updated_at') = (v_new - 'updated_at') then
      return new;
    end if;
  end if;

  -- WICHTIG: Das Audit-Log ist ein passiver Beobachter und darf den
  -- eigentlichen Schreibvorgang NIEMALS blockieren. Schlägt der Akteur-
  -- Lookup oder der Insert fehl (z. B. fehlender auth.users-Zugriff), wird
  -- der Fehler geschluckt, der Geschäftsvorgang läuft regulär weiter.
  begin
    select coalesce(
             nullif(trim(concat(p.first_name, ' ', p.last_name)), ''),
             u.email,
             'System'
           )
      into v_actor
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = auth.uid();

    insert into public.audit_log (company_id, actor_id, actor_name, table_name, record_id, action, old_data, new_data)
    values (v_company_id, auth.uid(), coalesce(v_actor, 'System'), tg_table_name, v_record_id, lower(tg_op), v_old, v_new);
  exception
    when others then
      -- bewusst still: Audit-Fehler dürfen CRUD nicht beeinträchtigen.
      null;
  end;

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger an die Geschäftstabellen hängen.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['drivers', 'vehicles', 'compliance_documents', 'incidents', 'shift_assignments']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s
         for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS: nur Geschäftsführer/Betriebsleiter dürfen das Audit-Log lesen.
-- Geschrieben wird ausschließlich über den SECURITY DEFINER Trigger.
-- ---------------------------------------------------------------------
alter table public.audit_log enable row level security;

drop policy if exists "audit_select_admins" on public.audit_log;
create policy "audit_select_admins" on public.audit_log
  for select to authenticated
  using (company_id = any (public.get_user_admin_company_ids()));

-- Realtime, damit die Verlaufsansicht live mitschreibt.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_log'
  ) then
    alter publication supabase_realtime add table public.audit_log;
  end if;
end $$;
