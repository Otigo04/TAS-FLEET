-- =====================================================================
-- 0012_roles_rbac.sql
-- Verfeinert das Rollenmodell auf die fachlichen Rollen:
--   owner  = Geschäftsführer  (Vollzugriff inkl. Mitgliederverwaltung)
--   admin  = Betriebsleiter   (operativer Vollzugriff)
--   member = Disponent        (Disposition, Vorfälle, Abwesenheiten)
--
-- Die Enum-Codes bleiben unverändert (RLS hängt daran); nur die Policies
-- werden so justiert, dass ein Disponent disponieren und Vorfälle erfassen
-- darf, während Mitglieder-/Rollenverwaltung dem Geschäftsführer vorbehalten
-- bleibt. Stammdaten (Fahrer/Fahrzeuge/Compliance) bleiben für den
-- Disponenten lesbar, aber nicht schreibbar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: Companies, in denen der Nutzer Geschäftsführer (owner) ist.
-- ---------------------------------------------------------------------
create or replace function public.get_user_owner_company_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(company_id), '{}')
  from public.company_users
  where user_id = auth.uid()
    and role = 'owner';
$$;

-- ---------------------------------------------------------------------
-- Disposition: ein Disponent (member) muss Schichten zuweisen können.
-- INSERT von "nur owner/admin" auf "jedes Mitglied der Company" lockern.
-- (UPDATE/DELETE erlauben bereits jedes Mitglied – siehe 0009.)
-- ---------------------------------------------------------------------
drop policy if exists "tenant_insert_shift_assignments" on public.shift_assignments;
create policy "tenant_insert_shift_assignments" on public.shift_assignments
  for insert to authenticated
  with check (company_id = any (public.get_user_company_ids()));

-- ---------------------------------------------------------------------
-- Vorfälle: ein Disponent meldet Vorfälle. INSERT ebenfalls für jedes
-- Mitglied freigeben (UPDATE/DELETE sind bereits offen, siehe 0009).
-- ---------------------------------------------------------------------
drop policy if exists "tenant_insert_incidents" on public.incidents;
create policy "tenant_insert_incidents" on public.incidents
  for insert to authenticated
  with check (company_id = any (public.get_user_company_ids()));

-- ---------------------------------------------------------------------
-- Mitgliederverwaltung nur für den Geschäftsführer (owner).
-- Vorher: owner UND admin (get_user_admin_company_ids). Jetzt: owner only.
-- Lesen bleibt für alle Mitglieder erlaubt (members_select_company_users).
-- Superadmins verwalten über die Konsole per Service-Role (umgeht RLS).
-- ---------------------------------------------------------------------
drop policy if exists "admins_manage_company_users" on public.company_users;
create policy "owners_manage_company_users" on public.company_users
  for all to authenticated
  using (company_id = any (public.get_user_owner_company_ids()))
  with check (company_id = any (public.get_user_owner_company_ids()));

-- ---------------------------------------------------------------------
-- Company umbenennen ebenfalls dem Geschäftsführer vorbehalten.
-- ---------------------------------------------------------------------
drop policy if exists "admins_update_companies" on public.companies;
create policy "owners_update_companies" on public.companies
  for update to authenticated
  using (id = any (public.get_user_owner_company_ids()))
  with check (id = any (public.get_user_owner_company_ids()));

revoke all on function public.get_user_owner_company_ids() from public;
grant execute on function public.get_user_owner_company_ids() to authenticated;
