# Supabase Setup

## 1) SQL Migration ausfuehren

Fuehre die Migrationen in dieser Reihenfolge im Supabase SQL Editor aus:

1. supabase/migrations/0001_mvp_schema.sql
2. supabase/migrations/0002_driver_notes.sql
3. supabase/migrations/0003_operations_center.sql

## 2) Auth aktivieren

Aktiviere in Supabase Auth mindestens Email/Password Sign-In und lege Admin-User an.

## 3) Realtime pruefen

Stelle sicher, dass die Tabellen in der publication supabase_realtime enthalten sind:

- public.drivers
- public.vehicles
- public.shift_assignments
- public.compliance_documents
- public.incidents

## 4) Daten testen

Lege erste Datensaetze in drivers und vehicles an. Das Dashboard aktualisiert sich live ueber Realtime-Subscriptions.
