-- Migration 010: Add hrv_status and training_status to daily_readiness

ALTER TABLE daily_readiness
  ADD COLUMN IF NOT EXISTS hrv_status TEXT,
  ADD COLUMN IF NOT EXISTS training_status TEXT;

INSERT INTO schema_migrations(version) VALUES ('010_daily_readiness_columns')
ON CONFLICT DO NOTHING;
