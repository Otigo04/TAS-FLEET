-- =====================================================================
-- 0011_company_logo.sql
-- Adds an optional logo / profile image to companies. The image is
-- stored as a data URL (consistent with how driver/vehicle/user avatars
-- are persisted in this app), so no Storage bucket is required.
--
-- Read access:  members of the company already SELECT the companies row
--               (members_select_companies), so logo_url comes along.
-- Write access: superadmins manage it via the service-role admin client
--               (bypasses RLS); company owners/admins may also update it
--               under the existing admins_update_companies policy.
-- =====================================================================

alter table public.companies
  add column if not exists logo_url text;
