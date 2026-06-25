-- =====================================================================
-- 0019_vacation_quota.sql
-- Phase 6: optionales Jahres-Urlaubskontingent je Fahrer. Der Resturlaub
-- wird in der App aus (Kontingent − genommene Urlaubstage im Jahr) berechnet.
-- =====================================================================

alter table public.drivers add column if not exists annual_vacation_days integer;
