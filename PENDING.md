# Ausstehende Phasen – Garmin Training Dashboard

Implementierter Stand: Phase 1–10 (großteils abgeschlossen).

---

## ✅ Implementiert (diese Session)

### Phase 4 – Workout-Status & Trainingshistorie
- ✅ **4.1** `PATCH /api/readiness/[date]` – Workout als `done | skipped | modified` markieren
- ✅ **4.1** `WeekPlanCard` – Status-Buttons (✓/✕) für heutige + vergangene Tage
- ✅ **4.2** `/strength/history` – Session-Verlauf mit Filter, Volumen-Sparkline, Satz-Details
- ✅ **4.3** `/api/personal-records` + `PRBoard` – PRs (Kraft + Lauf), Delta vs. Vorjahr

### Phase 5 – Ernährungs-Vertiefung
- ✅ **5.2** `CarbCycleCalendar` – 4-Wochen-Kalender nach Wochenskelett (in Nutrition)
- ✅ **5.3** `WeightChart` – SVG-Chart: Rohgewicht + 7T-Trend + KFA (in Trends + Nutrition)
- ✅ **5.4** `daily_input.alcohol_units` (Migration 004), DailyInputModal-Feld, Readiness-Warnung
- ⏳ **5.1** Kalorien-Logging (meal_logs) – noch offen

### Phase 6 – Lauf-Analyse & Concurrent Training
- ✅ **6.1** `PostWorkoutCard` + `/api/activities/recent-analyses` (in Trends)
- ✅ **6.2** `checkConcurrentTraining()` in readiness.ts + Dashboard-Banner
- ✅ **6.3** `/settings/zones` – Lauf-Pace-Zonen-Kalkulator (LTHR + VO2max)

### Phase 7 – Frau-Profil
- ✅ **7.3** `/api/profile/goals` + Settings-Ziele-Sektion
- ⏳ **7.1+7.2** Frau-spezifische Trainingslogik – noch offen

### Phase 8 – Deployment & Infrastruktur
- ✅ **8.1** `sync-worker/Dockerfile` (Python 3.12 slim) + railway.toml auf Dockerfile umgestellt
- ✅ **8.2** `/api/garmin/credentials` + Settings-Garmin-Sektion (Verbindungsstatus, Sync-Polling)
- ✅ **8.3** `/onboarding` – 4-Schritt-Wizard (Körper → LTHR-Zonen → Phase → Garmin)
- ✅ **8.4** `db/migrate.sh` – Idempotentes Migrations-Skript

### Phase 9 – UI-Polish & Mobile
- ✅ **9.1** `public/manifest.json` – PWA-Manifest (standalone, dark theme)
- ✅ **9.2** `SkeletonCard/SkeletonChart/SkeletonList` – Animierte Placeholder-Komponenten
- ⏳ **9.3** Offline-Service-Worker – noch offen
- ⏳ **9.4** Web-Push-Benachrichtigungen – noch offen

### Phase 10 – Daten-Export
- ✅ **10.1** `/api/export/csv?type=weight|readiness|strength` + Settings-Export-Links
- ⏳ **10.2** JSON-Vollexport (ZIP) – noch offen

---

## Noch Ausstehend

### 5.1 Kalorien-Logging (Mahlzeiten-Tracking)
- **API** `POST /api/meals/log` – Mahlzeit aus Template ins `meal_logs` loggen
- **API** `GET /api/meals/log?date=` – Tageslog abrufen
- **Seite** `/nutrition/log` – Tagesansicht: Mahlzeiten tracken, Gesamtkalorien vs. Ziel
- **Komponente** `MealLogger` – Pro Mahlzeit-Slot: Template auswählen + loggen

### 7.1+7.2 Frau-Profil (Baseline Building)
- **DB** `user_profiles.current_phase = 'baseline_building'` für Frau
- **Readiness-Logik**: Bei `baseline_building` kein Deload-Trigger, Zone-2-Fokus
- **Settings**: Phase-Option "Baseline Building" für Frau-Profil

### 9.3+9.4 PWA-Erweiterungen
- **Service Worker** für Offline-Fallback (letzte gecachte Daten)
- **Web Push API** für Deload/NEAT-Benachrichtigungen

### 10.2 JSON-Vollexport
- **API** `GET /api/export/full` – Alle User-Daten als ZIP

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
| 7 | `public/icons/` | PWA-Icons (192px + 512px) fehlen – Manifest verweist darauf, Fallback fehlt |

---

## Abhängigkeiten & Reihenfolge für Restaufgaben

```
5.1 (Meal Logging)   → unabhängig, nächste sinnvolle Erweiterung
7.1+7.2 (Frau)       → braucht Phase 8.3 (Onboarding bereits da)
9.3 (Service Worker) → nach 9.1 (Manifest bereits da)
10.2 (JSON-Export)   → unabhängig
```
