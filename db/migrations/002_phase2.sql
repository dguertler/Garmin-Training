-- ============================================================
-- Migration 002 – Phase 2: Post-Workout-Analyse, Zonenverteilung,
--                          Deload-Tracking-Erweiterung, Template-Bibliothek
-- ============================================================

-- Post-Workout-Auswertung (automatisch nach Activity-Sync)
CREATE TABLE IF NOT EXISTS post_workout_analyses (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id         UUID NOT NULL REFERENCES garmin_activities(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Vergleich mit letzter gleichartiger Session
    prev_activity_id    UUID REFERENCES garmin_activities(id),
    analysis_date       DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Lauf-Analyse
    avg_pace_vs_prev    NUMERIC(6,2),   -- Sekunden/km Delta (negativ = schneller)
    avg_hr_vs_prev      NUMERIC(5,2),   -- BPM Delta
    distance_vs_prev    NUMERIC(8,2),   -- Meter Delta
    aerobic_decoupling  NUMERIC(5,2),   -- % Drift (Pa:HR) – Ausdauer-Indikator

    -- Kraft-Analyse
    volume_vs_prev      NUMERIC(8,2),   -- kg Delta Gesamtvolumen
    avg_rir             NUMERIC(4,2),   -- Durchschnitts-RIR der Session

    -- 80/20-Zone-Check für diese Einheit
    pct_z1z2            NUMERIC(5,2),   -- % in Zone 1+2
    pct_z3              NUMERIC(5,2),   -- % in Zone 3 (grauer Bereich)
    pct_z4z5            NUMERIC(5,2),   -- % in Zone 4+5

    -- Bewertung: 'good' | 'ok' | 'warning'
    overall_rating      TEXT DEFAULT 'ok',
    insights            JSONB,          -- [{type, message, severity}, ...]

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(activity_id)
);

CREATE INDEX IF NOT EXISTS idx_post_workout_user_date
    ON post_workout_analyses(user_id, analysis_date DESC);

-- Wöchentliche Zonenverteilung (materialisierter Cache)
CREATE TABLE IF NOT EXISTS weekly_zone_distribution (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,

    total_training_seconds  INT DEFAULT 0,
    z1_seconds      INT DEFAULT 0,
    z2_seconds      INT DEFAULT 0,
    z3_seconds      INT DEFAULT 0,
    z4_seconds      INT DEFAULT 0,
    z5_seconds      INT DEFAULT 0,

    -- Prozentwerte
    z1_pct          NUMERIC(5,2),
    z2_pct          NUMERIC(5,2),
    z3_pct          NUMERIC(5,2),
    z4_pct          NUMERIC(5,2),
    z5_pct          NUMERIC(5,2),

    -- 80/20 Check
    low_intensity_pct   NUMERIC(5,2),   -- z1+z2 kombiniert
    high_intensity_pct  NUMERIC(5,2),   -- z4+z5 kombiniert
    polarization_ok     BOOLEAN,        -- low ≥ 75% AND high ≤ 25%

    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, week_start_date)
);

-- Mahlzeiten-Log (geloggte Mahlzeiten pro Tag)
CREATE TABLE IF NOT EXISTS meal_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    template_id     UUID REFERENCES meal_templates(id),
    meal_slot       TEXT NOT NULL,

    -- Kann von Template abweichen (manuell editiert)
    name            TEXT NOT NULL,
    calories        INT NOT NULL,
    protein_g       NUMERIC(7,2) NOT NULL,
    carbs_g         NUMERIC(7,2) NOT NULL,
    fat_g           NUMERIC(7,2) NOT NULL,
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date
    ON meal_logs(user_id, log_date DESC);

-- Frau-Profil: Ziele separat
CREATE TABLE IF NOT EXISTS profile_goals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    target_weight_kg        NUMERIC(5,2),
    target_body_fat_pct     NUMERIC(5,2),
    goal_description        TEXT,           -- "Rekomposition", "Fettabbau", etc.

    -- Wöchentliche Trainingszeit-Ziele
    weekly_cardio_minutes   INT DEFAULT 120,
    weekly_strength_sessions INT DEFAULT 3,

    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NEAT-Warnsystem: Monatsdurchschnitt Schritte
CREATE TABLE IF NOT EXISTS neat_baselines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_start     DATE NOT NULL,
    avg_daily_steps INT,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, month_start)
);

INSERT INTO schema_migrations(version) VALUES ('002_phase2')
ON CONFLICT DO NOTHING;
