-- Migration 004: Alkohol als Störvariable in daily_input
ALTER TABLE daily_input ADD COLUMN IF NOT EXISTS alcohol_units INTEGER DEFAULT 0;

INSERT INTO schema_migrations(version) VALUES ('004_alcohol_field')
ON CONFLICT DO NOTHING;
