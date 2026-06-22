-- Migration 005: Profil-Ziele (Gewichtsziel, KFA-Ziel, Wochentraining)
CREATE TABLE IF NOT EXISTS profile_goals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    target_weight_kg    NUMERIC(5,2),
    target_body_fat_pct NUMERIC(5,2),
    weekly_strength_sessions INTEGER DEFAULT 3,
    weekly_cardio_sessions   INTEGER DEFAULT 2,
    target_date         DATE,
    notes               TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations(version) VALUES ('005_profile_goals')
ON CONFLICT DO NOTHING;
