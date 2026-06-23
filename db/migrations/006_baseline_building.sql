-- ============================================================
-- Migration 006 – Phase 7: Frau-Profil / Baseline Building
-- ============================================================

-- Add 'baseline_building' as valid phase option (no constraint existed, just a comment)
-- and add sex field to user_profiles for female-specific logic
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sex TEXT DEFAULT 'male' CHECK (sex IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS menstrual_phase TEXT DEFAULT NULL;

-- Update current_phase comment/check (already TEXT, no enum constraint)
-- 'baseline_building': Zone-2-Fokus, kein Deload-Trigger, niedrigere Intensitätsschwellen

COMMENT ON COLUMN user_profiles.current_phase IS
  'cut | bulk | maintenance | baseline_building';

COMMENT ON COLUMN user_profiles.sex IS
  'male | female | other – enables female-specific training logic';
