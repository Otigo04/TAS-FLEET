-- =====================================================================
-- 0010_superadmin.sql
-- Adds a platform-level "superadmin" role. Superadmins are NOT tied to a
-- company — they manage companies and users across the whole platform via
-- the Superadmin console (which uses the service-role key on the server).
--
-- This migration only needs to:
--   1. add profiles.is_superadmin
--   2. expose an is_superadmin() helper (for in-DB checks / future RLS)
--   3. tighten the profiles RLS (was wide-open) to self + superadmin
--   4. bootstrap the first superadmin by email
-- =====================================================================

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Helper usable inside policies; SECURITY DEFINER so it can read profiles
-- regardless of the caller's own row visibility.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Tighten profiles RLS. The original "Admins full access profiles"
-- policy used `using (true)`, letting every authenticated user read and
-- modify ALL profiles. Restrict to: your own row, or a superadmin.
-- ---------------------------------------------------------------------

drop policy if exists "Admins full access profiles" on public.profiles;

create policy "profiles_select_self_or_superadmin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_superadmin());

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_superadmin());

create policy "profiles_update_self_or_superadmin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_superadmin())
  with check (id = auth.uid() or public.is_superadmin());

create policy "profiles_delete_superadmin" on public.profiles
  for delete to authenticated
  using (public.is_superadmin());

-- ---------------------------------------------------------------------
-- Bootstrap: promote the platform owner to superadmin.
-- ---------------------------------------------------------------------

update public.profiles
set is_superadmin = true
where id in (
  select id from auth.users where lower(email) = lower('otigo12345@gmail.com')
);
