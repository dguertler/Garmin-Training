-- Migration 011: Fehlende Spalten in profile_goals nachrüsten

ALTER TABLE profile_goals
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS weekly_cardio_sessions INTEGER DEFAULT 2;

INSERT INTO schema_migrations(version) VALUES ('011_profile_goals_columns')
ON CONFLICT DO NOTHING;
