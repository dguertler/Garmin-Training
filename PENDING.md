# Ausstehende Phasen – Garmin Training Dashboard

Implementierter Stand: Phase 1–3 (DB-Schema, Sync, Dashboard, Strength, Nutrition, Readiness, Progression, Trends, Settings, NEAT, Zones).

---

## Phase 4 – Workout-Status & Trainingshistorie

### 4.1 Workout-Status-Tracking
- **API** `PATCH /api/readiness/[date]` – Workout als `done | skipped | modified` markieren
- **Komponente** `WeekPlanCard` um Status-Buttons erweitern (✓ Erledigt / × Übersprungen)
- **DB** `daily_readiness.workout_status` wird bereits gespeichert, fehlt nur das UI

### 4.2 Strength-Session-Verlauf
- **Seite** `/strength/history` – Übersicht aller Sessions (Datum, Typ, Volumen, Rating)
- **API** `GET /api/strength?limit=30&type=push` – Filterbarer Verlauf
- **Komponente** `StrengthHistoryChart` – Volumenverlauf (kg) + Ø RIR pro Bewegungsmuster über Zeit
- **DB** bereits vollständig (`strength_logs` + `strength_sets`)

### 4.3 Persönliche Rekorde (PRs)
- **API** `GET /api/personal-records` – Liest aus `personal_records` Tabelle
- **Komponente** `PRBoard` – Tabelle mit PR pro Disziplin (Kraft + Lauf), Delta vs. Vorjahr
- **Sync** `sync_weekly._save_personal_records()` – bereits in Sync vorgesehen, braucht DB-Eintrag

---

## Phase 5 – Ernährungs-Vertiefung

### 5.1 Kalorien-Logging (Mahlzeiten-Tracking)
- **API** `POST /api/meals/log` – Mahlzeit aus Template ins `meal_logs` loggen (Tabelle existiert)
- **API** `GET /api/meals/log?date=` – Tageslog abrufen
- **Seite** `/nutrition/log` – Tagesansicht: Mahlzeiten tracken, Gesamtkalorien vs. Ziel
- **Komponente** `MealLogger` – Pro Mahlzeit-Slot: Template auswählen + loggen

### 5.2 Carb-Cycling-Kalender
- **Komponente** `CarbCycleCalendar` – 4-Wochen-Kalender: Training (refeed/normal) vs. Ruhe (-70g)
- In `/nutrition` einbinden

### 5.3 Gewichtsverlauf-Chart
- **Komponente** `WeightChart` – Chart.js Liniendiagramm: Rohgewicht (grau) + 7-Tage-Trend (grün) + KFA (rechte Achse)
- In `/nutrition` + `/trends` einbinden
- Daten bereits vorhanden in `daily_input`

### 5.4 Alkohol als Störvariable
- **Feld** `daily_input.alcohol_units` (INTEGER) per Migration hinzufügen
- **DailyInputModal** um Alkohol-Feld erweitern
- **Readiness-Anzeige**: Hinweis wenn `alcohol_units > 0` und Readiness < 60

---

## Phase 6 – Lauf-Analyse & Concurrent Training

### 6.1 Post-Workout-Analyse-Anzeige
- **Komponente** `PostWorkoutCard` – Insights-Karten nach Aktivitätssync anzeigen
- **API** `GET /api/activities/recent-analyses` – Letzte 5 Analysen mit Insights
- In `/strength` oder `/trends` einbinden

### 6.2 Concurrent-Training-Warnung
- **Logik** in `src/lib/readiness.ts`: `checkConcurrentTraining(weekPlan)` – warnt wenn Zone2 + Krafttraining am gleichen Tag oder innerhalb 6h geplant
- **Dashboard** Warnung einblenden wenn Konflikt erkannt

### 6.3 Lauf-Pace-Zonen-Kalkulator
- **Seite** `/settings/zones` (Unterseite von Settings)
- Berechnet Lauf-Pace-Zonen aus LTHR + aktuellem VO2max
- Format: Zone 2 = X:XX–X:XX min/km

---

## Phase 7 – Frau-Profil (Baseline Building)

### 7.1 Frau-spezifische Trainingsphase
- **DB** `user_profiles.current_phase = 'baseline_building'` für Frau
- **Readiness-Logik**: Bei `baseline_building` kein Deload-Trigger, Zone-2-Fokus, niedrigere Schwellen
- **Settings**: Phase-Option "Baseline Building" für Frau-Profil hinzufügen

### 7.2 Frau-Dashboard-Unterschiede
- **Geteilte Ansicht** `/dashboard/shared` bereits implementiert (read-only)
- Frau-spezifische Empfehlungen: mehr Zone-2, weniger Intensität, Zyklus-Integration optional

### 7.3 Profil-Ziele (`profile_goals`)
- **API** `GET/PATCH /api/profile/goals` – Zielgewicht, KFA, Wochentraining-Ziele (Tabelle existiert)
- **Seite** `/settings` um Ziel-Sektion erweitern

---

## Phase 8 – Deployment & Infrastruktur

### 8.1 Railway-Deployment vollständig konfigurieren
- **Dockerfile** für `sync-worker` (Python 3.12, alle Dependencies)
- **`railway.toml`** bereits vorhanden – prüfen ob `[deploy]` und `[env]` vollständig
- **Environment-Variablen-Checkliste** in README: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GARMIN_ENCRYPT_KEY`, `WORKER_PORT`, `NEXTAUTH_URL`
- **Health-Check** `/api/health` bereits vorhanden

### 8.2 Garmin-Credentials-Setup-UI
- **Seite** `/setup` oder Modal in `/settings` – Garmin-E-Mail + Passwort eingeben
- **API** `POST /api/setup` bereits vorhanden – prüfen ob Credentials-Speicherung + Sync-Trigger funktioniert
- **Feedback**: Sync-Status nach erfolgreicher Authentifizierung zeigen

### 8.3 Erster-Start-Wizard
- **Seite** `/onboarding` – Schritt-für-Schritt für neuen User:
  1. Gewicht + KFA eingeben
  2. LTHR eingeben (oder "weiß ich nicht" → Standard-Zonen)
  3. Trainingsphase wählen
  4. Garmin-Credentials eingeben + ersten Sync auslösen
- Redirect nach `/dashboard` nach Abschluss

### 8.4 Datenbank-Migration-Skript
- **Skript** `db/migrate.sh` – führt alle Migrations-SQLs in Reihenfolge aus
- Idempotent durch `schema_migrations` Tabelle (bereits im Schema)

---

## Phase 9 – UI-Polish & Mobile

### 9.1 PWA-Manifest
- **`public/manifest.json`** – App-Name, Icons, Theme-Color (#0f172a), Display: standalone
- **`src/app/layout.tsx`** – `<link rel="manifest">` + Apple-Touch-Icon hinzufügen
- **`public/icons/`** – 192px + 512px Icons generieren

### 9.2 Loading-States verbessern
- Skeleton-Loader für alle Chart-Komponenten (HRVChart, SleepBars, PolarizedZonesChart)
- Error-Boundary für API-Fehler in Client-Komponenten

### 9.3 Offline-Fallback
- Service Worker: Dashboard zeigt letzte gecachte Daten wenn offline
- `next-pwa` oder custom Service Worker

### 9.4 Benachrichtigungen (optional)
- Web Push API: Deload-Empfehlung, Gear-Warnung, NEAT-Absenkung
- `public/sw.js` + Push-API

---

## Phase 10 – Daten-Export & Backup

### 10.1 CSV-Export
- **API** `GET /api/export/csv?type=weight|readiness|strength` – Daten als CSV
- Format: kompatibel mit Excel / Numbers

### 10.2 JSON-Vollexport
- **API** `GET /api/export/full` – Alle User-Daten als ZIP (für Daten-Portabilität)

---

## Bekannte Lücken / Tech Debt

| # | Datei | Problem |
|---|-------|---------|
| 1 | `src/app/api/dashboard/route.ts:137` | Type-Cast `entry_date → date` (Runtime OK, TS warnt) |
| 2 | `sync-worker/sync_daily.py` | `morning_readiness` Endpunkt doppelt (Zeile 135 = Kopie von `training_readiness`) |
| 3 | `src/components/NavBar.tsx` | NavBar zu voll auf Mobile (5 Links) – Hamburger-Menü oder Bottom-Nav |
| 4 | `src/app/api/strength/route.ts` | `_checkProgression()` liest `progression` über `/api/strength` – separate Route sauberer |
| 5 | `db/schema.sql` | `daily_input.source` Spalte fehlt noch in Hauptschema (nur in Migration 003) |
| 6 | `sync-worker/sync_daily.py` | Garmin Index Gewicht-Import ignoriert manuell eingetragene Tage nicht (nur `ON CONFLICT DO NOTHING` – korrekt, aber kein User-Feedback) |

---

## Abhängigkeiten & Reihenfolge

```
Phase 4 (Workout-Status) → unabhängig, schnell umsetzbar
Phase 5 (Mahlzeiten-Log) → braucht Phase 4 nicht
Phase 6 (Lauf-Analyse)   → braucht Phase 2 (Analysen bereits da)
Phase 7 (Frau-Profil)    → unabhängig
Phase 8 (Deployment)     → blockiert Production-Nutzung
Phase 9 (UI-Polish)      → nach Phase 8
Phase 10 (Export)        → nach Phase 8
```

**Empfohlene Reihenfolge:** 8.2 → 8.3 → 8.1 → 4.1 → 5.3 → 9.1 → Rest
