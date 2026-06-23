-- 008: Password reset tokens + force change on first login
ALTER TABLE user_credentials
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_uc_reset_token
  ON user_credentials (password_reset_token)
  WHERE password_reset_token IS NOT NULL;
