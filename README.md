# ON Mobility Portal

Internes Verwaltungsportal für die Fuhrpark- und Fahrerverwaltung von ON Mobility, entwickelt von **Oryon Systems**.

## Was kann die App?

### Dashboard
Übersicht auf einen Blick: Gesamtzahl der Fahrer und Fahrzeuge, aktueller Flottenstatus (Aktiv / Wartung / Offline) und eine Fristen-Warnanzeige für ablaufende Dokumente und P-Scheine (60-Tage-Vorschau).

### Fahrer
Vollständiges CRUD für alle Fahrer. Felder: Name, Adresse, Geburtsdatum, Nationalität, Familienstand, P-Schein-Ablaufdatum, Bezirk, aktuelle Schicht (Früh / Spät / Nacht). Fahrerdaten können auch per **Excel/CSV-Import** (Fahrerblatt) massenweise eingepflegt werden, inklusive OCR-Parsing via Tesseract.js.

### Fahrzeuge
Verwaltung der gesamten Fahrzeugflotte: Kennzeichen, Modell, Baujahr, Status (Aktiv / Wartung / Offline). Filter- und Suchfunktion.

### Disposition
Tagesbasierte Schichtzuweisung: Fahrer und Fahrzeuge werden den Schichten Früh, Spät und Nacht zugeordnet. Echtzeit-Sync über Supabase Realtime — Änderungen sind sofort bei allen eingeloggten Nutzern sichtbar.

### Schichtzettel (Schichtplanung)
Datumsbezogene Schichtpläne: Wer fährt wann, mit welchem Fahrzeug. Export als PDF möglich (pdf-lib).

### Compliance-Center
Dokumentenverwaltung für Fristen-relevante Unterlagen (z. B. TÜV, Versicherung, Führerschein). Belegt Fristen-Warnungen auf dem Dashboard. Dokumenttypen sind über die Einstellungen konfigurierbar.

### Incident-Log
Erfassung von Vorfällen (Unfälle, Beschädigungen, sonstige Ereignisse) mit Zuweisung zu Fahrer oder Fahrzeug, Datum und Beschreibung.

### Einstellungen
Admin-Konfiguration: u. a. konfigurierbare Dokumenttypen für das Compliance-Center.

### Globale Suche
Schnellsuche über Fahrer und Fahrzeuge aus jeder Seite heraus.

---

## Technologiestack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Sprache | TypeScript 5 |
| Styling | Tailwind CSS + Shadcn UI |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Echtzeit | Supabase Realtime |
| PDF | pdf-lib, pdf-parse |
| OCR | Tesseract.js |

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Umgebungsvariablen (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Architektur-Hinweise

- **Authentifizierung**: Supabase Auth mit Profil-Onboarding nach erstem Login (`/profile-setup`).
- **Rollenmodell**: Aktuell ein einziger Rollentyp — Admin mit Vollzugriff. Row Level Security (RLS) ist auf Supabase-Ebene aktiv.
- **Echtzeit**: Alle CRUD-Komponenten abonnieren ihren jeweiligen Supabase-Channel und bereinigen die Subscription sauber im `useEffect`-Cleanup.
- **Konflikthandling**: Last Write Wins — die zuletzt gespeicherte Änderung gewinnt. Durch Realtime sehen alle Nutzer Änderungen sofort.
- **Import**: Der `/api/import-driver-sheet`-Endpunkt nimmt eine Excel/CSV-Datei entgegen, parst sie serverseitig und importiert Fahrerdatensätze mit Duplikat-Erkennung.

---

## Projektstruktur (verkürzt)

```
app/
  (portal)/         # Alle geschützten Portalseiten
    dashboard/
    fahrer/
    fahrzeuge/
    disposition/
    schichtplanung/
    compliance/
    incidents/
    einstellungen/
    search/
  login/
  profile-setup/

components/
  portal/           # Feature-Komponenten (CRUD, Planner, ...)
  ui/               # Generische UI-Bausteine (Shadcn)

lib/
  supabase/         # Client, Server-Client, DB-Typen
  auth.ts           # requireCompletedUser Helper
  driver-sheet-parser.ts

supabase/
  migrations/       # SQL-Migrationsdateien
```
