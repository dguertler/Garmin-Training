# Ausstehende Phasen – Garmin Training Dashboard

Implementierter Stand: Phase 1–10 (vollständig abgeschlossen, inkl. 9.4 Web Push).

---

## ✅ Implementiert (alle Phasen)

### Phase 4 – Workout-Status & Trainingshistorie
- ✅ **4.1** `PATCH /api/readiness/[date]` – Workout als `done | skipped | modified` markieren
- ✅ **4.1** `WeekPlanCard` – Status-Buttons (✓/✕) für heutige + vergangene Tage
- ✅ **4.2** `/strength/history` – Session-Verlauf mit Filter, Volumen-Sparkline, Satz-Details
- ✅ **4.3** `/api/personal-records` + `PRBoard` – PRs (Kraft + Lauf), Delta vs. Vorjahr

### Phase 5 – Ernährungs-Vertiefung
- ✅ **5.1** `/nutrition/log` + `MealLogger` – Tages-Mahlzeiten-Tracking mit Template-Picker und manuellem Eintrag
- ✅ **5.2** `CarbCycleCalendar` – 4-Wochen-Kalender nach Wochenskelett (in Nutrition)
- ✅ **5.3** `WeightChart` – SVG-Chart: Rohgewicht + 7T-Trend + KFA (in Trends + Nutrition)
- ✅ **5.4** `daily_input.alcohol_units` (Migration 004), DailyInputModal-Feld, Readiness-Warnung

### Phase 6 – Lauf-Analyse & Concurrent Training
- ✅ **6.1** `PostWorkoutCard` + `/api/activities/recent-analyses` (in Trends)
- ✅ **6.2** `checkConcurrentTraining()` in readiness.ts + Dashboard-Banner
- ✅ **6.3** `/settings/zones` – Lauf-Pace-Zonen-Kalkulator (LTHR + VO2max)

### Phase 7 – Frau-Profil
- ✅ **7.1+7.2** Baseline Building Phase – Zone-2-Wochenskelett, kein Deload-Trigger, Sex-Feld in Profil
- ✅ **7.3** `/api/profile/goals` + Settings-Ziele-Sektion

### Phase 8 – Deployment & Infrastruktur
- ✅ **8.1** `sync-worker/Dockerfile` (Python 3.12 slim) + railway.toml auf Dockerfile umgestellt
- ✅ **8.2** `/api/garmin/credentials` + Settings-Garmin-Sektion (Verbindungsstatus, Sync-Polling)
- ✅ **8.3** `/onboarding` – 4-Schritt-Wizard (Körper → LTHR-Zonen → Phase → Garmin)
- ✅ **8.4** `db/migrate.sh` – Idempotentes Migrations-Skript

### Phase 9 – UI-Polish & Mobile
- ✅ **9.1** `public/manifest.json` – PWA-Manifest (standalone, dark theme)
- ✅ **9.2** `SkeletonCard/SkeletonChart/SkeletonList` – Animierte Placeholder-Komponenten
- ✅ **9.3** `public/sw.js` + `ServiceWorkerRegistrar` – Offline Service Worker (network-first + Cache-Fallback)
- ✅ **9.4** Web-Push-Benachrichtigungen – Deload + NEAT Alerts, VAPID, Push-Subscription-Tabelle

### Phase 10 – Daten-Export
- ✅ **10.1** `/api/export/csv?type=weight|readiness|strength` + Settings-Export-Links
- ✅ **10.2** `/api/export/full` – Alle User-Daten als ZIP (pure-JS ZIP-Builder, 8 JSON-Dateien)

---

## Alles implementiert ✅

Alle Phasen 1–10 inkl. 9.4 sind fertig. Nächste Schritte: Deployment (siehe unten).

---

## Bekannte Lücken / Tech Debt

| # | Datei | Problem |
|---|-------|---------|
| 1 | `src/app/api/dashboard/route.ts:137` | Type-Cast `entry_date → date` (Runtime OK, TS warnt) |
| 2 | `sync-worker/sync_daily.py` | `morning_readiness` Endpunkt doppelt (Zeile 135 = Kopie von `training_readiness`) |
| 3 | `src/components/NavBar.tsx` | NavBar zu voll auf Mobile (5 Links) – Hamburger-Menü oder Bottom-Nav |
| 4 | `src/app/api/strength/route.ts` | `_checkProgression()` liest `progression` über `/api/strength` – separate Route sauberer |
| 5 | `db/schema.sql` | `daily_input.source` Spalte fehlt noch in Hauptschema (nur in Migration 003) |
| 6 | `sync-worker/sync_daily.py` | Garmin Index Gewicht-Import ignoriert manuell eingetragene Tage nicht |
| 7 | `public/icons/` | PWA-Icons (192px + 512px) fehlen – Manifest verweist darauf, Fallback fehlt |

---

## Migrations-Reihenfolge

```
001_initial.sql           ✅ Basis-Schema
002_phase2.sql            ✅ Post-Workout, Zonen, Templates
003_indexes.sql           ✅ Performance-Indizes
004_alcohol_field.sql     ✅ daily_input.alcohol_units
005_profile_goals.sql     ✅ profile_goals Tabelle
006_baseline_building.sql ✅ user_profiles.sex + Baseline-Phase-Kommentar
007_push_subscriptions.sql ✅ push_subscriptions (Web Push)
```

## Deployment-Checkliste

| # | Aufgabe |
|---|---------|
| 1 | `npm install` – web-push Paket installieren |
| 2 | VAPID-Keys generieren: `npx web-push generate-vapid-keys` |
| 3 | Env-Vars setzen: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:deine@email.de` |
| 4 | `db/migrate.sh` ausführen (Migrationen 004–007) |
| 5 | PWA-Icons erstellen: `public/icon-192.png` + `public/icon-512.png` |
| 6 | Branch nach main mergen |
