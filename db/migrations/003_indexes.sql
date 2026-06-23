-- Migration 003: Zusätzliche Indizes + fehlende Constraints
-- ============================================================

-- Index für schnelle NEAT-Baseline-Abfragen
CREATE INDEX IF NOT EXISTS idx_neat_baselines_user_month
    ON neat_baselines(user_id, month_start DESC);

-- Index für Zone-Distribution-Abfragen
CREATE INDEX IF NOT EXISTS idx_weekly_zone_user_week
    ON weekly_zone_distribution(user_id, week_start_date DESC);

-- Index für Post-Workout-Analysen nach User
CREATE INDEX IF NOT EXISTS idx_post_workout_user
    ON post_workout_analyses(user_id, analysis_date DESC);

-- Index für Trends-Abfragen auf garmin_raw_metrics
CREATE INDEX IF NOT EXISTS idx_garmin_raw_vo2_hr
    ON garmin_raw_metrics(user_id, metric_date DESC)
    WHERE vo2max IS NOT NULL OR resting_heart_rate IS NOT NULL;

-- Index für Aktivitätstyp-basierte Suche (prev similar activity)
CREATE INDEX IF NOT EXISTS idx_garmin_activities_user_type
    ON garmin_activities(user_id, activity_type, start_time DESC);

-- Sicherstellen dass profile_key in users existiert (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_key TEXT;

-- Herkunft des Gewichts-Eintrags (manuell vs. Garmin Index)
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

INSERT INTO schema_migrations(version) VALUES ('003_indexes')
ON CONFLICT DO NOTHING;
