-- ============================================================
-- Garmin Training Dashboard – vollständiges DB-Schema
-- Phase 1 MVP
-- ============================================================

-- Erweiterungen
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    -- 'daniel' | 'frau' – steuert Profil-Defaults
    profile_key     TEXT NOT NULL CHECK (profile_key IN ('daniel', 'frau')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NextAuth-kompatible Tabellen
CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    provider            TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token       TEXT,
    access_token        TEXT,
    expires_at          BIGINT,
    token_type          TEXT,
    scope               TEXT,
    id_token            TEXT,
    session_state       TEXT,
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token TEXT UNIQUE NOT NULL,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT UNIQUE NOT NULL,
    expires    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- Passwort-Hashes für Credentials-Login (bcrypt, separate Tabelle)
CREATE TABLE user_credentials (
    user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash            TEXT NOT NULL,
    force_password_change    BOOLEAN NOT NULL DEFAULT FALSE,
    password_reset_token     TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. GARMIN TOKEN-CACHE (garth OAuth)
-- ============================================================

CREATE TABLE garmin_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- garth speichert OAuth1-Tokens als JSON; AES-256-verschlüsselt mit pgcrypto
    token_data_enc  BYTEA NOT NULL,
    -- Initialer Login-Zeitpunkt; für Token-Alter-Prüfung
    authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at TIMESTAMPTZ,
    -- Status: 'active' | 'expired' | 'error'
    status          TEXT NOT NULL DEFAULT 'active',
    error_message   TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. SYNC-STATUS (Fehler sichtbar im Dashboard)
-- ============================================================

CREATE TABLE sync_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 'daily' | 'activity_delta' | 'weekly' | 'manual'
    job_type        TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    -- 'running' | 'success' | 'partial' | 'error'
    status          TEXT NOT NULL DEFAULT 'running',
    endpoints_total  INT DEFAULT 0,
    endpoints_success INT DEFAULT 0,
    error_details   JSONB,
    -- Letzte erfolgreiche Aktivitäts-ID für Delta-Check
    last_activity_id BIGINT
);

-- ============================================================
-- 4. TÄGLICHE GARMIN-ROHDATEN
-- ============================================================

CREATE TABLE garmin_raw_metrics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date     DATE NOT NULL,

    -- Training Readiness
    training_readiness_score        SMALLINT,   -- 0-100
    training_readiness_factors      JSONB,      -- {hrv_status, sleep_score, body_battery, ...}
    morning_readiness_score         SMALLINT,
    training_status                 TEXT,       -- 'Peaking' | 'Productive' | 'Maintaining' | 'Recovery' | ...
    training_status_raw             JSONB,

    -- HRV
    hrv_weekly_average              NUMERIC(6,2),
    hrv_last_night                  NUMERIC(6,2),
    hrv_5night_average              NUMERIC(6,2),
    hrv_baseline_low                NUMERIC(6,2),
    hrv_baseline_high               NUMERIC(6,2),
    hrv_status                      TEXT,       -- 'Balanced' | 'Low' | 'Unbalanced' | 'Poor'
    hrv_raw                         JSONB,

    -- Schlaf
    sleep_score                     SMALLINT,
    sleep_duration_seconds          INT,
    sleep_deep_seconds              INT,
    sleep_rem_seconds               INT,
    sleep_light_seconds             INT,
    sleep_awake_seconds             INT,
    sleep_start_time                TIMESTAMPTZ,
    sleep_end_time                  TIMESTAMPTZ,
    sleep_raw                       JSONB,

    -- Body Battery
    body_battery_morning            SMALLINT,   -- Wert beim Aufwachen
    body_battery_evening            SMALLINT,   -- Wert am Abend
    body_battery_curve              JSONB,      -- [{time, value}, ...] Tageskurve
    body_battery_raw                JSONB,

    -- Aktivität & Schritte
    steps_total                     INT,
    steps_goal                      INT,
    steps_hourly                    JSONB,      -- [{hour, steps}, ...]
    calories_total                  INT,
    calories_active                 INT,
    calories_bmr                    INT,
    distance_meters                 NUMERIC(10,2),
    active_minutes_moderate         INT,
    active_minutes_vigorous         INT,
    floors_climbed                  SMALLINT,
    intensity_minutes               INT,
    intensity_minutes_goal          INT,
    user_summary_raw                JSONB,

    -- Herzfrequenz
    resting_heart_rate              SMALLINT,
    hr_min                          SMALLINT,
    hr_max                          SMALLINT,
    hr_average                      SMALLINT,
    hr_daily_curve                  JSONB,      -- [{time, value}, ...]
    heart_rates_raw                 JSONB,

    -- Stress
    stress_average                  SMALLINT,
    stress_max                      SMALLINT,
    stress_curve                    JSONB,
    stress_raw                      JSONB,

    -- VO2max & Fitness
    vo2max                          NUMERIC(5,2),
    fitness_age                     SMALLINT,
    max_metrics_raw                 JSONB,

    -- Atemfrequenz & SpO2
    respiration_average             NUMERIC(5,2),
    respiration_raw                 JSONB,
    spo2_average                    NUMERIC(5,2),
    spo2_raw                        JSONB,

    -- Körperkomposition (Garmin Index / Waage)
    body_weight_garmin              NUMERIC(5,2),   -- kg, von Garmin-Waage
    body_fat_percent_garmin         NUMERIC(5,2),   -- % KFA, von Garmin-Waage
    bmi_garmin                      NUMERIC(5,2),
    body_composition_raw            JSONB,
    daily_weigh_ins_raw             JSONB,

    -- Hydration & Ernährung
    hydration_goal_ml               INT,
    hydration_intake_ml             INT,
    hydration_raw                   JSONB,
    nutrition_calories              INT,
    nutrition_carbs_g               NUMERIC(7,2),
    nutrition_protein_g             NUMERIC(7,2),
    nutrition_fat_g                 NUMERIC(7,2),
    nutrition_raw                   JSONB,

    -- Lactat-Schwelle (für Zonen-Kalibrierung)
    lactate_threshold_hr            SMALLINT,
    lactate_threshold_pace          TEXT,       -- mm:ss/km
    lactate_threshold_raw           JSONB,

    -- Stats kombiniert
    stats_and_body_raw              JSONB,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, metric_date)
);

CREATE INDEX idx_garmin_raw_metrics_user_date
    ON garmin_raw_metrics(user_id, metric_date DESC);

-- ============================================================
-- 5. MANUELLE TAGESEINGABE (Gewicht / KFA)
-- ============================================================

CREATE TABLE daily_input (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date      DATE NOT NULL,

    weight_kg       NUMERIC(5,2) NOT NULL,
    body_fat_pct    NUMERIC(5,2) NOT NULL,
    -- Automatisch berechnet aus obigen Werten
    lean_mass_kg    NUMERIC(5,2) GENERATED ALWAYS AS
                        (weight_kg * (1 - body_fat_pct / 100)) STORED,
    -- BMR nach Katch-McArdle: 370 + 21.6 * Magermasse
    bmr_kcal        NUMERIC(7,2) GENERATED ALWAYS AS
                        (370 + 21.6 * weight_kg * (1 - body_fat_pct / 100)) STORED,

    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, entry_date)
);

CREATE INDEX idx_daily_input_user_date
    ON daily_input(user_id, entry_date DESC);

-- ============================================================
-- 6. ERNÄHRUNGS-ZIELE (täglich berechnet)
-- ============================================================

CREATE TABLE nutrition_targets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_date     DATE NOT NULL,

    -- Quelle der Gewichtsdaten
    weight_kg       NUMERIC(5,2) NOT NULL,
    lean_mass_kg    NUMERIC(5,2) NOT NULL,
    bmr_kcal        NUMERIC(7,2) NOT NULL,
    active_calories INT,                -- aus Garmin (mit 0,75-Korrekturfaktor für Kraft)
    tdee_kcal       NUMERIC(7,2),       -- BMR + korrigierte active calories
    tdee_adjusted   NUMERIC(7,2),       -- nach Selbstkalibrierung
    tdee_calibration_offset NUMERIC(7,2) DEFAULT 0, -- Kalibrierungs-Delta

    -- Phase: 'cut' | 'bulk' | 'maintenance'
    phase           TEXT NOT NULL DEFAULT 'cut',
    -- Trainingstag beeinflusst Carb-Cycling
    is_training_day BOOLEAN NOT NULL DEFAULT FALSE,
    -- Refeed-Tag: +40-60g Carbs
    is_refeed_day   BOOLEAN NOT NULL DEFAULT FALSE,

    -- Kalorienziel
    calories_target INT NOT NULL,

    -- Makroziele
    protein_target_g    NUMERIC(7,2) NOT NULL,
    carbs_target_g      NUMERIC(7,2) NOT NULL,
    fat_target_g        NUMERIC(7,2) NOT NULL,

    -- Mahlzeitenplan (5 Mahlzeiten)
    meal_plan           JSONB,  -- [{meal_number, time, kcal, protein_g, carbs_g, fat_g, name, examples}, ...]

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, target_date)
);

CREATE INDEX idx_nutrition_targets_user_date
    ON nutrition_targets(user_id, target_date DESC);

-- ============================================================
-- 7. TDEE-SELBSTKALIBRIERUNG
-- ============================================================

CREATE TABLE tdee_calibrations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calibration_date    DATE NOT NULL,

    -- 7-Tage-Mittel: Woche 1 vs. Woche 2
    weight_avg_week1    NUMERIC(5,2) NOT NULL,
    weight_avg_week2    NUMERIC(5,2) NOT NULL,
    actual_delta_kg     NUMERIC(5,2),   -- reale Gewichtsänderung
    expected_delta_kg   NUMERIC(5,2),   -- erwartete Änderung basierend auf Defizit
    -- Abweichung > 100g → TDEE nachjustieren
    tdee_adjustment_kcal NUMERIC(7,2),
    new_tdee_kcal       NUMERIC(7,2),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. TRAININGSPLÄNE & WOCHENSKELETT
-- ============================================================

CREATE TABLE training_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name       TEXT NOT NULL,
    -- 'active' | 'archived'
    status          TEXT NOT NULL DEFAULT 'active',
    -- Wochenskelett als JSON
    weekly_skeleton JSONB NOT NULL,
    -- z.B. {"monday": "push", "tuesday": "zone2_run", ...}
    phase           TEXT NOT NULL DEFAULT 'cut',
    started_at      DATE NOT NULL DEFAULT CURRENT_DATE,
    ended_at        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Täglicher Readiness-gesteuerter Plan
CREATE TABLE daily_readiness (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_date           DATE NOT NULL,

    -- Aus Garmin nativ übernommen
    readiness_score     SMALLINT,       -- 0-100
    -- 'prime' (73-100) | 'moderate' (34-72) | 'low' (<34) | 'unknown'
    readiness_level     TEXT NOT NULL DEFAULT 'unknown',

    -- Basierend auf Wochenskelett
    scheduled_workout_type  TEXT,       -- 'push' | 'pull' | 'legs' | 'zone2_run' | 'rest' | 'mobility'
    -- Nach Readiness-Modulation
    recommended_workout_type TEXT,
    recommendation_reason   TEXT,       -- Einzeiler: "HRV 18% unter Baseline, ..."
    intensity_modifier      NUMERIC(4,2) DEFAULT 1.0,  -- 0.8 = -20%
    volume_modifier         NUMERIC(4,2) DEFAULT 1.0,

    -- Faktor-Aufschlüsselung (sichtbar im Dashboard)
    hrv_vs_baseline_pct     NUMERIC(6,2),   -- % Abweichung vom Normalbereich
    sleep_score             SMALLINT,
    body_battery_morning    SMALLINT,
    recovery_time_hours     INT,            -- Garmin Recovery Advisor
    stress_yesterday        SMALLINT,

    -- Status: 'planned' | 'completed' | 'modified' | 'skipped'
    workout_status          TEXT DEFAULT 'planned',
    completed_at            TIMESTAMPTZ,

    -- Deload-Flag
    is_deload_week          BOOLEAN DEFAULT FALSE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, plan_date)
);

CREATE INDEX idx_daily_readiness_user_date
    ON daily_readiness(user_id, plan_date DESC);

-- ============================================================
-- 9. AKTIVITÄTEN (Garmin)
-- ============================================================

CREATE TABLE garmin_activities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garmin_activity_id  BIGINT NOT NULL,

    activity_date   DATE NOT NULL,
    start_time      TIMESTAMPTZ,
    -- 'running' | 'strength_training' | 'cycling' | 'walking' | ...
    activity_type   TEXT NOT NULL,
    activity_name   TEXT,

    duration_seconds    INT,
    distance_meters     NUMERIC(10,2),
    calories            INT,
    avg_hr              SMALLINT,
    max_hr              SMALLINT,
    avg_pace_per_km     NUMERIC(6,2),   -- Sekunden/km
    avg_speed_mps       NUMERIC(6,3),

    -- Lauf-spezifisch
    avg_cadence         SMALLINT,
    total_ascent_m      SMALLINT,
    total_descent_m     SMALLINT,
    training_effect_aerobic   NUMERIC(4,2),
    training_effect_anaerobic NUMERIC(4,2),

    -- Kraft-spezifisch
    num_sets            SMALLINT,
    num_exercises       SMALLINT,

    -- Wetter
    weather             JSONB,

    -- Gear
    gear_name           TEXT,
    gear_uuid           TEXT,

    garmin_raw          JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, garmin_activity_id)
);

CREATE INDEX idx_garmin_activities_user_date
    ON garmin_activities(user_id, activity_date DESC);
CREATE INDEX idx_garmin_activities_type
    ON garmin_activities(user_id, activity_type, activity_date DESC);

-- Sekündliche Rohdaten (getrennte Tabelle wegen Größe)
CREATE TABLE garmin_activity_details (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id     UUID NOT NULL REFERENCES garmin_activities(id) ON DELETE CASCADE,
    -- Sekündliche Datenpunkte als JSONB-Array (komprimiert)
    track_points    JSONB,  -- [{t, hr, pace, lat, lon, alt, cadence}, ...]
    raw_data        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(activity_id)
);

-- Splits / Kilometer-Laps
CREATE TABLE garmin_activity_splits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id     UUID NOT NULL REFERENCES garmin_activities(id) ON DELETE CASCADE,
    split_index     SMALLINT NOT NULL,
    split_type      TEXT,               -- 'km' | 'lap' | 'set'
    distance_meters NUMERIC(8,2),
    duration_seconds INT,
    avg_hr          SMALLINT,
    avg_pace_per_km NUMERIC(6,2),
    avg_speed_mps   NUMERIC(6,3),
    elevation_gain  NUMERIC(6,2),
    raw_data        JSONB,

    UNIQUE(activity_id, split_index)
);

-- HF-Zonenverteilung pro Aktivität
CREATE TABLE garmin_activity_hr_zones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id     UUID NOT NULL REFERENCES garmin_activities(id) ON DELETE CASCADE,
    zone_number     SMALLINT NOT NULL CHECK (zone_number BETWEEN 1 AND 5),
    zone_name       TEXT,
    seconds_in_zone INT,
    pct_in_zone     NUMERIC(5,2),
    hr_low          SMALLINT,
    hr_high         SMALLINT,

    UNIQUE(activity_id, zone_number)
);

-- ============================================================
-- 10. KRAFTTRAINING – DETAILLIERTES LOGGING
-- ============================================================

CREATE TABLE strength_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date        DATE NOT NULL,
    activity_id     UUID REFERENCES garmin_activities(id),

    -- Workout-Typ aus Wochenskelett
    workout_type    TEXT NOT NULL,  -- 'push' | 'pull' | 'legs'

    -- Readiness zum Zeitpunkt des Trainings
    readiness_score_at_training SMALLINT,

    -- Gesamt-Volumen der Session
    total_volume_kg     NUMERIC(10,2),   -- Σ (sätze × wdh × gewicht)
    duration_minutes    INT,
    subjective_rating   SMALLINT CHECK (subjective_rating BETWEEN 1 AND 5),
    session_notes       TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE strength_sets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id          UUID NOT NULL REFERENCES strength_logs(id) ON DELETE CASCADE,

    -- Bewegungsmuster aus Progressionsleiter
    movement_pattern    TEXT NOT NULL,  -- 'pullup' | 'dip' | 'push' | 'leg' | 'core' | ...
    exercise_name       TEXT NOT NULL,  -- 'Assisted Pull-up' | 'Archer Pull-up' | ...
    -- Skill-Level auf Progressionsleiter (1 = Anfänger)
    skill_level         SMALLINT NOT NULL DEFAULT 1,

    set_number          SMALLINT NOT NULL,
    reps                SMALLINT NOT NULL,
    bodyweight_kg       NUMERIC(5,2),       -- BW zum Zeitpunkt
    added_weight_kg     NUMERIC(5,2) DEFAULT 0,
    total_load_kg       NUMERIC(5,2),       -- BW + Zusatzlast (oder nur Zusatz bei Maschinen)

    -- RIR: 0-5 (Pflichtfeld)
    rir                 SMALLINT NOT NULL CHECK (rir BETWEEN 0 AND 5),

    -- Volumen: sätze × wdh × last
    volume_kg           NUMERIC(8,2) GENERATED ALWAYS AS
                            (reps * COALESCE(added_weight_kg, 0)) STORED,

    -- Garmin Übungs-Tracking (Uhr-Daten)
    garmin_exercise_set JSONB,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strength_sets_log
    ON strength_sets(log_id);
CREATE INDEX idx_strength_sets_movement_user
    ON strength_sets(movement_pattern, log_id);

-- ============================================================
-- 11. CALISTHENICS-PROGRESSIONSLEITER
-- ============================================================

CREATE TABLE calisthenics_progression (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Bewegungsmuster
    movement_pattern    TEXT NOT NULL,  -- 'pullup' | 'dip' | 'push' | 'leg'
    current_skill_level SMALLINT NOT NULL DEFAULT 1,
    current_exercise    TEXT NOT NULL,

    -- Kriterium für Aufstieg erfüllt (z.B. 3×10 sauber)
    progression_criteria_met    BOOLEAN DEFAULT FALSE,
    last_assessed_date          DATE,

    -- Verlauf
    history             JSONB,  -- [{date, level, exercise, reps_achieved}, ...]

    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, movement_pattern)
);

-- Progressionsleiter-Definition (statische Referenztabelle)
CREATE TABLE progression_ladder (
    movement_pattern    TEXT NOT NULL,
    skill_level         SMALLINT NOT NULL,
    exercise_name       TEXT NOT NULL,
    advancement_criteria TEXT NOT NULL,  -- "3×10 mit sauberer Form"
    notes               TEXT,
    PRIMARY KEY (movement_pattern, skill_level)
);

-- Pullup-Leiter
INSERT INTO progression_ladder VALUES
    ('pullup', 1, 'Negativwiederholung',         '3×5 kontrolliert (5s runter)',          NULL),
    ('pullup', 2, 'Assisted Pull-up (Band)',      '3×8 mit leichtem Band',                 NULL),
    ('pullup', 3, 'Bodyweight Pull-up',           '3×10 saubere Form',                     NULL),
    ('pullup', 4, 'Weighted Pull-up',             '3×8 mit +10 kg',                        NULL),
    ('pullup', 5, 'Archer Pull-up',               '3×6 je Seite',                          NULL),
    ('pullup', 6, 'One-Arm Pull-up Negativ',      '3×3 je Seite kontrolliert',             NULL),
    ('pullup', 7, 'One-Arm Pull-up',              '3×3 je Seite sauber',                   NULL);

-- Dip-Leiter
INSERT INTO progression_ladder VALUES
    ('dip', 1, 'Negativwiederholung',             '3×5 kontrolliert (5s runter)',          NULL),
    ('dip', 2, 'Bodyweight Dip',                  '3×10 saubere Form',                     NULL),
    ('dip', 3, 'Weighted Dip',                    '3×8 mit +10 kg',                        NULL),
    ('dip', 4, 'Ring Dip',                        '3×8 stabile Ringe',                     NULL),
    ('dip', 5, 'Bulgarian Dip',                   '3×8 je Seite',                          NULL);

-- Push-Leiter
INSERT INTO progression_ladder VALUES
    ('push', 1, 'Push-up',                        '3×15 saubere Form',                     NULL),
    ('push', 2, 'Archer Push-up',                 '3×8 je Seite',                          NULL),
    ('push', 3, 'Pike Push-up',                   '3×10 saubere Form',                     NULL),
    ('push', 4, 'HSPU Negativ',                   '3×5 kontrolliert',                      NULL),
    ('push', 5, 'Handstand Push-up (Wand)',        '3×8 sauber',                            NULL),
    ('push', 6, 'Handstand Push-up (frei)',        '3×5 frei stehend',                      NULL),
    ('push', 7, 'One-Arm Push-up',                '3×5 je Seite',                          NULL);

-- Leg-Leiter
INSERT INTO progression_ladder VALUES
    ('leg', 1, 'Bodyweight Squat',                '3×20 saubere Form',                     NULL),
    ('leg', 2, 'Bulgarian Split Squat',           '3×12 je Seite',                         NULL),
    ('leg', 3, 'Pistol Squat Negativ',            '3×5 kontrolliert (5s runter)',           NULL),
    ('leg', 4, 'Pistol Squat (Assisted)',         '3×8 je Seite mit Stütze',               NULL),
    ('leg', 5, 'Pistol Squat',                    '3×8 je Seite frei',                     NULL),
    ('leg', 6, 'Weighted Pistol Squat',           '3×6 je Seite mit Gewicht',              NULL);

-- ============================================================
-- 12. WÖCHENTLICHE GARMIN-METRIKEN
-- ============================================================

CREATE TABLE garmin_weekly_metrics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,  -- immer Montag

    steps_total         INT,
    steps_avg_daily     INT,
    stress_avg          SMALLINT,
    endurance_score     NUMERIC(6,2),
    hill_score          NUMERIC(6,2),
    running_tolerance   NUMERIC(6,2),   -- Verletzungsrisiko-Indikator
    vo2max              NUMERIC(5,2),

    -- Laufprognosen
    race_prediction_5k_seconds      INT,
    race_prediction_10k_seconds     INT,
    race_prediction_hm_seconds      INT,
    race_prediction_marathon_seconds INT,

    -- Trainingsvolumen der Woche
    total_training_minutes          INT,
    total_distance_meters           NUMERIC(12,2),

    -- HF-Zonenverteilung der Woche (80/20-Check)
    zone1_pct   NUMERIC(5,2),
    zone2_pct   NUMERIC(5,2),
    zone3_pct   NUMERIC(5,2),
    zone4_pct   NUMERIC(5,2),
    zone5_pct   NUMERIC(5,2),

    -- Wochenschritte-Verlauf (52 Wochen)
    weekly_steps_history    JSONB,
    weekly_stress_history   JSONB,
    progress_summary        JSONB,

    raw_data        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, week_start_date)
);

-- ============================================================
-- 13. AUSRÜSTUNG / GEAR (Schuh-km)
-- ============================================================

CREATE TABLE garmin_gear (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garmin_gear_uuid    TEXT NOT NULL,
    gear_type       TEXT,   -- 'shoes' | 'bike' | ...
    gear_name       TEXT NOT NULL,
    distance_meters NUMERIC(12,2) DEFAULT 0,
    -- Warnung bei > 600 km für Laufschuhe
    max_distance_meters NUMERIC(12,2) DEFAULT 600000,
    is_active       BOOLEAN DEFAULT TRUE,
    last_synced_at  TIMESTAMPTZ,
    raw_data        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, garmin_gear_uuid)
);

-- ============================================================
-- 14. LAUFPROGNOSEN (Verlauf für Widget)
-- ============================================================

CREATE TABLE garmin_race_predictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_date   DATE NOT NULL,

    pred_5k_seconds         INT,
    pred_10k_seconds        INT,
    pred_hm_seconds         INT,
    pred_marathon_seconds   INT,

    raw_data        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, recorded_date)
);

-- ============================================================
-- 15. PERSÖNLICHE REKORDE
-- ============================================================

CREATE TABLE personal_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 'run_5k' | 'run_10k' | 'run_hm' | 'run_marathon' | 'pullup_max' | ...
    record_type     TEXT NOT NULL,
    value           NUMERIC(10,2) NOT NULL,  -- Sekunden (Lauf), Reps (Kraft), kg (Last)
    unit            TEXT NOT NULL,           -- 'seconds' | 'reps' | 'kg'
    achieved_date   DATE NOT NULL,
    activity_id     UUID REFERENCES garmin_activities(id),
    raw_data        JSONB,

    UNIQUE(user_id, record_type)    -- nur neuester PR
);

-- Verlauf aller PRs
CREATE TABLE personal_records_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_type     TEXT NOT NULL,
    value           NUMERIC(10,2) NOT NULL,
    unit            TEXT NOT NULL,
    achieved_date   DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. BENUTZERPROFILE & EINSTELLUNGEN
-- ============================================================

CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Körperdaten (täglich überschrieben via daily_input, hier initiale Defaults)
    weight_kg       NUMERIC(5,2),
    body_fat_pct    NUMERIC(5,2),

    -- Training
    -- 'cut' | 'bulk' | 'maintenance'
    current_phase   TEXT NOT NULL DEFAULT 'cut',
    phase_start_date DATE,
    bulk_start_date  DATE,  -- geplanter Phasenwechsel

    -- HRV-Baseline (Garmin native, aber Tracking ob aufgebaut)
    hrv_baseline_established    BOOLEAN DEFAULT FALSE,
    hrv_baseline_nights_logged  SMALLINT DEFAULT 0,
    -- ~19 Nächte nötig

    -- HF-Zonen (aus LTHR berechnet)
    lthr                SMALLINT,   -- Lactat-Schwellen-HF
    hr_zone1_low        SMALLINT,
    hr_zone1_high       SMALLINT,
    hr_zone2_low        SMALLINT,
    hr_zone2_high       SMALLINT,
    hr_zone3_low        SMALLINT,
    hr_zone3_high       SMALLINT,
    hr_zone4_low        SMALLINT,
    hr_zone4_high       SMALLINT,
    hr_zone5_low        SMALLINT,
    hr_zone5_high       SMALLINT,
    hr_zones_source     TEXT DEFAULT 'pending',  -- 'lthr' | 'estimated' | 'pending'

    -- Deload-Tracking
    last_deload_date        DATE,
    next_deload_planned     DATE,
    -- Wochen seit letztem Deload
    weeks_since_deload      SMALLINT DEFAULT 0,

    -- Schritt-Ziel
    daily_steps_goal    INT DEFAULT 8000,

    -- Garmin Credentials (verschlüsselt in garmin_tokens)
    garmin_username     TEXT,   -- E-Mail, klar (kein Passwort hier gespeichert)

    -- Geteilte Ansicht: kann Daniel/Frau gegenseitig lesen?
    allow_shared_view   BOOLEAN DEFAULT TRUE,

    -- TDEE-Kalibrierung Status
    tdee_kcal_current   NUMERIC(7,2),
    tdee_last_calibrated_at DATE,

    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. MAHLZEITEN-TEMPLATES (Bibliothek)
-- ============================================================

CREATE TABLE meal_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = global
    template_name   TEXT NOT NULL,
    -- 'breakfast' | 'lunch' | 'pre_workout' | 'dinner' | 'pre_sleep'
    meal_slot       TEXT,

    calories        INT NOT NULL,
    protein_g       NUMERIC(7,2) NOT NULL,
    carbs_g         NUMERIC(7,2) NOT NULL,
    fat_g           NUMERIC(7,2) NOT NULL,

    ingredients     JSONB,  -- [{name, amount_g, unit}, ...]
    preparation     TEXT,

    is_training_day_suitable    BOOLEAN DEFAULT TRUE,
    is_rest_day_suitable        BOOLEAN DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vorausgefüllte Templates (Daniel, aus Spezifikation)
-- Werden nach User-Erstellung befüllt (via Seed-Script)

-- ============================================================
-- 18. DELOAD-TRACKING
-- ============================================================

CREATE TABLE deload_weeks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    -- 'planned' | 'readiness_triggered' | 'manual'
    trigger_reason  TEXT NOT NULL,
    readiness_scores JSONB,  -- Scores der Triggerwoche
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. INDIZES & PERFORMANCE
-- ============================================================

CREATE INDEX idx_garmin_activities_garmin_id
    ON garmin_activities(user_id, garmin_activity_id);

CREATE INDEX idx_nutrition_targets_date
    ON nutrition_targets(user_id, target_date DESC);

CREATE INDEX idx_sync_jobs_user_status
    ON sync_jobs(user_id, status, started_at DESC);

CREATE INDEX idx_strength_logs_user_date
    ON strength_logs(user_id, log_date DESC);

CREATE INDEX idx_personal_records_user
    ON personal_records(user_id, record_type);

-- ============================================================
-- 20. UPDATED_AT TRIGGER (automatisch)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_garmin_tokens_updated_at
    BEFORE UPDATE ON garmin_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_garmin_raw_metrics_updated_at
    BEFORE UPDATE ON garmin_raw_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_nutrition_targets_updated_at
    BEFORE UPDATE ON nutrition_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_daily_readiness_updated_at
    BEFORE UPDATE ON daily_readiness
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_strength_logs_updated_at
    BEFORE UPDATE ON strength_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_calisthenics_progression_updated_at
    BEFORE UPDATE ON calisthenics_progression
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_garmin_weekly_metrics_updated_at
    BEFORE UPDATE ON garmin_weekly_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_garmin_gear_updated_at
    BEFORE UPDATE ON garmin_gear
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 21. INITIALE DATEN: Daniel-Profil (Seed)
-- ============================================================
-- Wird via separatem Seed-Script befüllt, wenn Railway-DB bereit ist.
-- Enthält: user, user_profile, progression ladder defaults,
--          meal_templates aus der Spezifikation.

-- ============================================================
-- SCHEMA-VERSION
-- ============================================================

CREATE TABLE schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations(version) VALUES ('001_initial_schema');
