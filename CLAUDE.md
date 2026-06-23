# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Garmin Training Dashboard — a readiness-driven training and nutrition dashboard for two profiles (Daniel + Frau). Built with Next.js 14 (App Router), PostgreSQL on Railway, and a Python sync-worker that pulls data from Garmin Connect via the `garminconnect` library.

## Deployment & Infrastructure

- **Hosting**: Railway (two services: `web` = Next.js, `sync-worker` = Python cron)
- **Database**: PostgreSQL on Railway — connection via `DATABASE_URL` env var
- **Branch strategy**: Always push to `main`. Do NOT use feature branches for deployment — Railway deploys from `main` only.
- **Railway login credentials**: email and initial password are stored in Railway environment variables (`RAILWAY_EMAIL`, `RAILWAY_INITIAL_PASSWORD` or similar — check Railway dashboard env vars)

## Commands

```bash
# Development
npm run dev

# Build (removes next.config.ts if present, then builds)
npm run build

# Lint
npm run lint

# Database
npm run db:migrate     # apply schema.sql
npm run db:seed        # apply seed.sql
npm run db:reset       # drop + migrate + seed

# Generate VAPID keys (Web Push)
npx web-push generate-vapid-keys
```

No test suite is configured — verify features manually via the running app.

## Architecture

### Next.js Web Service (`src/`)

- **`src/app/`** — App Router pages and API routes
- **`src/lib/`** — Shared server utilities:
  - `db.ts` — singleton PostgreSQL pool (`query`, `queryOne` helpers)
  - `auth.ts` — NextAuth config (Credentials provider, bcrypt, JWT)
  - `readiness.ts` — Core readiness engine: computes training recommendations from Garmin scores
  - `nutrition.ts`, `push.ts`, `email.ts` — domain helpers
- **`src/app/api/`** — API routes covering: auth, dashboard, sync, garmin credentials, readiness, strength, activities, nutrition, meals, trends, personal-records, calibration, deload, export, push

### Python Sync-Worker (`sync-worker/`)

Runs as a separate Railway service. Connects to Garmin via `garth` (OAuth token caching) and writes raw data to PostgreSQL.

- `main.py` — entry point, schedule logic (09:00 MEZ daily, DST-aware)
- `garmin_auth.py` — OAuth token management (tokens stored AES-256 encrypted in `garmin_tokens` table)
- `sync_daily.py` — daily metrics sync (HRV, sleep, body battery, readiness scores, etc.)
- `sync_weekly.py` — weekly metrics (every Monday)
- `sync_activities.py` — delta-check for new activities, pulls splits/HR zones/details
- `compute_readiness.py` — post-sync readiness calculation
- `post_workout_analysis.py` — activity analysis after sync
- `web_server.py` — lightweight HTTP server for `/health` and `/trigger` endpoints

### Database Schema (`db/`)

Migrations run in order via `db/migrate.sh` (idempotent):

```
001_initial.sql           — core schema
002_phase2.sql            — post-workout, zones, templates
003_indexes.sql           — performance indexes
004_alcohol_field.sql     — daily_input.alcohol_units
005_profile_goals.sql     — profile_goals table
006_baseline_building.sql — user_profiles.sex + baseline phase
007_push_subscriptions.sql — Web Push subscriptions
```

Key tables: `users`, `user_credentials`, `garmin_tokens`, `garmin_raw_metrics`, `garmin_activities`, `garmin_activity_details`, `garmin_activity_splits`, `garmin_activity_hr_zones`, `garmin_weekly_metrics`, `garmin_gear`, `daily_input`, `user_profiles`

### Auth

- NextAuth with Credentials provider (email + bcrypt password)
- Two profiles: `daniel` and `frau` (controlled by `profile_key` in `users` table)
- Garmin OAuth tokens stored encrypted (AES-256 via pgcrypto) in `garmin_tokens`

### Readiness Engine

Garmin's native Training Readiness score (0–100, from Firstbeat Analytics) is used directly:
- **73–100 (PRIME)**: hard training approved
- **34–72 (MODERATE)**: reduce intensity, prioritize Zone 2
- **<34 (LOW)**: rest day or mobility only

The engine supplements this with HRV-vs-baseline, sleep score, body battery, and stress history for transparent factor display. HRV baseline requires ~19 nights; new profiles show "baseline building" state with conservative recommendations.

## Required Environment Variables

```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
GARMIN_ENCRYPTION_KEY        # AES key for token encryption
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT                # mailto:email@domain.com
```

## Known Tech Debt

See `PENDING.md` for the full list. Notable items:
- `sync-worker/sync_daily.py` has a duplicate `morning_readiness` endpoint call (line ~135)
- `db/schema.sql` is missing `daily_input.source` column (only in migration 003)
- PWA icons (`public/icons/192px` + `512px`) are missing — manifest references them without fallback
- NavBar is overcrowded on mobile (5 links, no hamburger/bottom-nav yet)
