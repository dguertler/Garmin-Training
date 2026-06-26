-- ============================================================
-- Migration 012 – Phasen-Ratgeber + Trainingszeit/Mahlzeiten-Timing
-- ============================================================

-- Phasen-Preset (z.B. cut_aggressive | cut_moderate | cut_lean | maintenance |
-- lean_bulk | bulk_moderate | baseline_building). current_phase bleibt die
-- Basis-Kategorie und wird parallel gepflegt.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phase_preset TEXT DEFAULT NULL,
  -- Wöchentlicher Default-Trainingsplan: { "1": {"time":"18:00","type":"strength"}, ... }
  -- Key = JS getDay() (0=So … 6=Sa)
  ADD COLUMN IF NOT EXISTS weekly_training_schedule JSONB DEFAULT NULL;

COMMENT ON COLUMN user_profiles.phase_preset IS
  'cut_aggressive | cut_moderate | cut_lean | maintenance | lean_bulk | bulk_moderate | baseline_building';

-- Per-Tag-Override der Trainingszeit (überschreibt Wochenplan an einzelnen Tagen)
ALTER TABLE daily_input
  ADD COLUMN IF NOT EXISTS training_time TIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workout_type  TEXT DEFAULT NULL;

-- Effektive Trainingszeit, mit der der Mahlzeitenplan berechnet wurde
ALTER TABLE nutrition_targets
  ADD COLUMN IF NOT EXISTS training_time TIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workout_type  TEXT DEFAULT NULL;

INSERT INTO schema_migrations(version) VALUES ('012_phase_advisor_training_time')
  ON CONFLICT DO NOTHING;
