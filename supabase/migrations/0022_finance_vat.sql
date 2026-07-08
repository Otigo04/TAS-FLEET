-- =====================================================================
-- 0022_finance_vat.sql
-- Umsatzsteuer (USt) auf Finanz-Buchungen.
--
-- amount_eur ist der BRUTTObetrag (wie erfasst/gezahlt). Der USt-Satz je
-- Buchung wird in vat_rate gespeichert (Prozent, z. B. 19, 7, 0). Daraus
-- leitet das UI ab:
--   Netto        = Brutto / (1 + Satz/100)
--   USt-Anteil   = Brutto − Netto
--   Einnahme     → vereinnahmte Umsatzsteuer (Ausgangsseite)
--   Ausgabe      → abziehbare Vorsteuer (Eingangsseite)
--   Zahllast     = Σ USt(Einnahmen) − Σ Vorsteuer(Ausgaben)
--
-- Default 0 für Bestandsdaten: bestehende Buchungen bleiben unverändert
-- (kein rückwirkender USt-Ausweis). Das Formular schlägt 19 % vor.
-- Kleinunternehmer (§19 UStG) wird in settings.finance_config gepflegt.
-- =====================================================================

alter table public.finance_entries
  add column if not exists vat_rate numeric(5, 2) not null default 0
    check (vat_rate >= 0 and vat_rate <= 100);
