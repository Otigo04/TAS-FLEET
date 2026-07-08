-- =====================================================================
-- 0023_shift_names.sql
-- Konfigurierbare Schichtnamen.
--
-- Bisher war shift_assignments.shift_slot per CHECK auf die drei Uber-
-- typischen Schichten ('Frueh', 'Spaet', 'Nacht') beschränkt. Das System
-- nutzen nicht nur Uber-Unternehmer — Schichtnamen müssen frei definierbar
-- sein (über settings, key 'shift_names', analog zu vehicle_statuses etc.).
--
-- Daher wird der CHECK-Constraint entfernt. shift_slot bleibt Pflichtfeld
-- (not null) und Teil der Unique-Constraints (keine Doppelbelegung je Tag),
-- akzeptiert aber nun beliebige, vom Unternehmen gepflegte Werte.
-- Bestehende Zuweisungen bleiben unverändert gültig.
-- =====================================================================

alter table public.shift_assignments
  drop constraint if exists shift_assignments_shift_slot_check;
