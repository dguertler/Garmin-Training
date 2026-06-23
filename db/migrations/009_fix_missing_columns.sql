-- Migration 009: Fix missing columns discovered at runtime

-- garmin_activity_hr_zones: API expects time_in_zone_seconds, schema has seconds_in_zone
ALTER TABLE garmin_activity_hr_zones
  ADD COLUMN IF NOT EXISTS time_in_zone_seconds INT;

-- Bestehende Daten kopieren falls vorhanden
UPDATE garmin_activity_hr_zones
  SET time_in_zone_seconds = seconds_in_zone
  WHERE time_in_zone_seconds IS NULL AND seconds_in_zone IS NOT NULL;

-- profile_goals: migration 002 created table with weekly_cardio_minutes, API expects weekly_cardio_sessions
ALTER TABLE profile_goals
  ADD COLUMN IF NOT EXISTS weekly_cardio_sessions INTEGER DEFAULT 2;

INSERT INTO schema_migrations(version) VALUES ('009_fix_missing_columns')
ON CONFLICT DO NOTHING;
