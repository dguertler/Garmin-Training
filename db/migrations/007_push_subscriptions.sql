-- ============================================================
-- Migration 007 – Web Push Subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Web Push Subscription JSON (endpoint + keys)
    endpoint                TEXT NOT NULL,
    p256dh                  TEXT NOT NULL,
    auth                    TEXT NOT NULL,

    -- Throttle: einmal pro Tag maximal
    last_deload_notified_at TIMESTAMPTZ,
    last_neat_notified_at   TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(user_id);
